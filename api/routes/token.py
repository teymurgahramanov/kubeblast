from api.services import auth
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from api.core import models

router = APIRouter(prefix="/api")

@router.post("/token", response_model=models.Token)
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
  return auth.login(form_data)