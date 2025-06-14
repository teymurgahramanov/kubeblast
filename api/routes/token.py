from services import auth
from fastapi import APIRouter, Depends, Query
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated, Literal
from core import models

router = APIRouter(prefix="/api")

@router.post("/token", response_model=models.Token)
async def login(
  form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
  method: Annotated[Literal["ldap", "local"], Query(...)] = "local"
  ):
  return auth.login(form_data,method)