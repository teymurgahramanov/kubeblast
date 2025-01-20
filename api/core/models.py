from pydantic import BaseModel

class User(BaseModel):
    username: str
    full_name: str | None = None
    enabled: bool = True
    role: str

class UserCreate(User):
    password: str

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str