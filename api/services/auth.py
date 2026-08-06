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
from services import users

SECRET_KEY = config.SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES = config.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = config.REFRESH_TOKEN_EXPIRE_DAYS
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/token")
# Use bcrypt with 8 rounds for faster verification (still secure, ~100ms vs ~2500ms with default 12 rounds)
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=8, deprecated="auto")

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

def authenticate_user(username: str = None, plain_password: str = None, method: str = "local", oidc_user_data: dict = None, pat_token: str = None):
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
            if config.LICENSE_VALID and config.LDAP_ENABLED:
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
        case "oidc":
            if config.LICENSE_VALID and config.OIDC_ENABLED:
                if not oidc_user_data:
                    logger.error("OIDC user data is required for OIDC authentication")
                    return False
                
                # Always normalize the incoming OIDC payload through OIDCAuth, so we don't
                # rely on callers to pre-shape the dict correctly.
                from services.oidc_auth import OIDCAuth
                oidc = OIDCAuth()
                try:
                    normalized_user = oidc.map_oidc_user_to_db_user(oidc_user_data)
                except Exception as e:
                    logger.error(f"Failed to map OIDC user data: {str(e)}")
                    return False
                
                username = normalized_user.username
                if not username:
                    logger.error("No username resolved from OIDC user data")
                    return False
                
                user = get_user(username)
                if user:
                    return user
                
                # Create new user if auto-create is enabled
                if config.OIDC_AUTO_CREATE_USERS:
                    try:
                        db.mongo.users.insert_one(normalized_user.dict())
                        logger.info(f"Created new OIDC user: {username}")
                        return users.get_user(username)
                    except Exception as e:
                        logger.error(f"Failed to create OIDC user: {str(e)}")
                        return False
                return False
            else:
                return False
        case "pat":
            if config.LICENSE_VALID:
                if not pat_token:
                    logger.error("PAT token is required for PAT authentication")
                    return False
                
                if not pat_token.startswith(config.PAT_STRING_PREFIX):
                    logger.error("Invalid PAT token format")
                    return False
                
                # Token format: kb_pat_<8-char-prefix>_<suffix>
                # Extract the 8-char prefix between the first and second underscore after PAT_STRING_PREFIX
                parts = pat_token.split('_')
                if len(parts) < 3:
                    logger.error("Invalid PAT token format")
                    return False
                token_prefix = parts[2]  # The 8-char prefix is the third part (kb_pat_PREFIX_suffix)
                
                # Find PAT by prefix
                pat_doc = db.mongo.pats.find_one({"prefix": token_prefix, "revoked": False})
                if not pat_doc:
                    logger.error("PAT not found or revoked")
                    return False
                
                # Verify the full token hash
                if not verify_password(pat_token, pat_doc["hashed_token"]):
                    logger.error("Invalid PAT token")
                    return False
                
                # Check expiration
                expires_at = pat_doc.get("expires_at")
                if expires_at:
                    # Handle both timezone-aware and naive datetimes
                    if expires_at.tzinfo is None:
                        expires_at = expires_at.replace(tzinfo=timezone.utc)
                    if expires_at < datetime.now(timezone.utc):
                        logger.error("PAT token expired")
                        return False
                
                # Get the user
                user = db.mongo.users.find_one({"username": pat_doc["user_id"]})
                if not user:
                    logger.error(f"User {pat_doc['user_id']} not found for PAT")
                    return False
                
                # Update last_used_at
                db.mongo.pats.update_one(
                    {"_id": pat_doc["_id"]},
                    {"$set": {"last_used_at": datetime.now(timezone.utc)}}
                )
                
                return models.UserInDB(**user)
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
    
    # Try PAT authentication first
    if token.startswith(config.PAT_STRING_PREFIX):
        user = authenticate_user(method="pat", pat_token=token)
        if not user:
            raise credentials_exception
        return user
    
    # Fall back to JWT authentication
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise credentials_exception
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
    to_encode.update({"exp": expire, "type": "access"})
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

def login(form_data=None, method="local", oidc_user_data=None) -> models.Token:
    if method == "oidc":
        if not oidc_user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OIDC user data is required",
            )
        # Don't assume the payload already contains `username`; OIDC providers vary.
        username = (
            oidc_user_data.get("username") or
            oidc_user_data.get("preferred_username") or
            oidc_user_data.get("login") or
            (oidc_user_data.get("email", "").split("@")[0] if oidc_user_data.get("email") else None) or
            oidc_user_data.get("sub")
        )
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
    
    user = authenticate_user(username, password, method, oidc_user_data=oidc_user_data)
    
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

    db.mongo.users.update_one(
        {"username": user.username},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )
    
    return models.Token(access_token=access_token, token_type="bearer", refresh_token=refresh_token)