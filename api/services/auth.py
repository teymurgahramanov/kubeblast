from datetime import datetime, timedelta, timezone
from typing import Annotated, List
from passlib.context import CryptContext
from core.log import logger

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from core import db, models
from config import config

SECRET_KEY = config.SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES = config.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = config.REFRESH_TOKEN_EXPIRE_DAYS
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str):
    return pwd_context.hash(password)

def get_user(username: str):
    user = db.mongo.users.find_one({"username": username})
    if user:
        return models.UserInDB(**user)
    else:
        return None

def authenticate_user(username: str, plain_password: str, method: str, oauth_user_data: dict = None):
    match method:
        case "local":
            user = get_user(username)
            if not user:
                logger.error(f"User {username} not found")
                return False
            if not verify_password(plain_password, user.hashed_password):
                logger.error(f"Invalid password for user {username}")
                return False
            return user
        case "ldap":
            if config.IS_PRO and config.LDAP_ENABLED:
                from .ldap_auth import LDAPAuth
                ldap_auth = LDAPAuth()
                try:
                    ldap_user = ldap_auth.authenticate(username, plain_password)
                except Exception as e:
                    logger.error(f"LDAP authentication failed for user {username}: {e}")
                    return False
                if ldap_user:
                    user = get_user(username)
                    if not user:
                        user = ldap_auth.map_ldap_user_to_db_user(ldap_user)
                        db.mongo.users.insert_one(user.dict())
                        return user
                    return user
            else:
                return False
        case "oauth":
            if config.IS_PRO and config.OAUTH_ENABLED:
                if not oauth_user_data:
                    logger.error("OAuth user data is required for OAuth authentication")
                    return False
                
                username = oauth_user_data.get("username")
                if not username:
                    logger.error("No username in OAuth user data")
                    return False
                
                user = get_user(username)
                if user:
                    return user
                
                # Create new user if auto-create is enabled
                if config.OAUTH_AUTO_CREATE_USERS:
                    try:
                        new_user = models.UserInDB(**oauth_user_data)
                        db.mongo.users.insert_one(new_user.dict())
                        logger.info(f"Created new OAuth user: {username}")
                        return new_user
                    except Exception as e:
                        logger.error(f"Failed to create OAuth user: {str(e)}")
                        return False
                return False
            else:
                return False
        case _:
            return False

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    user = get_user(username)
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: Annotated[models.User, Depends(get_current_user)]):
    if not current_user.enabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return models.User(**current_user.dict())

def check_role(allowed_roles: List[str]):
    def role_checker(current_user: models.User = Depends(get_current_active_user)):
        if not allowed_roles:
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(username: str) -> str:
    """Create a refresh token and store it in database."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": username,
        "exp": expire,
        "type": "refresh"
    }
    refresh_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    # Store refresh token in database
    db.mongo.refresh_tokens.update_one(
        {"username": username},
        {
            "$set": {
                "username": username,
                "token": refresh_token,
                "expires_at": expire,
                "created_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    return refresh_token

def verify_refresh_token(refresh_token: str) -> str:
    """Verify refresh token and return username."""
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Check if token exists in database
        stored_token = db.mongo.refresh_tokens.find_one({"username": username, "token": refresh_token})
        if not stored_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found or expired"
            )
        
        return username
        
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

def revoke_refresh_token(username: str):
    """Revoke user's refresh token."""
    db.mongo.refresh_tokens.delete_one({"username": username})

def login(form_data=None, method="local", oauth_user_data=None) -> models.Token:
    if method == "oauth":
        if not oauth_user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OAuth user data is required",
            )
        username = oauth_user_data.get("username")
        password = None
    else:
        if not form_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Form data is required",
            )
        username = form_data.username
        password = form_data.password
        logger.debug(f"Login attempt for user {username} with method {method}")
    
    user = authenticate_user(username, password, method, oauth_user_data=oauth_user_data)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, 
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    refresh_token = create_refresh_token(user.username)
    
    return models.Token(access_token=access_token, token_type="bearer", refresh_token=refresh_token)