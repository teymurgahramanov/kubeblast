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

def authenticate_user(username: str, plain_password: str, method: str):
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

def login(form_data, method) -> models.Token:
    logger.debug(f"Loggin attempt for user {form_data.username} with password {form_data.password} and method {method}")
    user = authenticate_user(form_data.username, form_data.password, method)
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
    return models.Token(access_token=access_token, token_type="bearer")