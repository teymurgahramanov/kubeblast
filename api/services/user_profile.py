from core import models, db
from services import auth
from config import config
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
from typing import List
from bson import ObjectId
import secrets
import string

def generate_alphanumeric(length: int) -> str:
    """Generate a random alphanumeric string (letters and numbers only)."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def get_profile(username: str):
    user = db.mongo.users.find_one({"username": username})
    return models.User(**user)

def update_profile(username: str, user_data: dict):
    user = get_profile(username).dict()
    if user["method"] == "local":
      user_data = {key: value for key, value in user_data.items() if value not in [None, "", [], {}, ()]}
      if "password" in user_data:
          user_data["hashed_password"] = auth.hash_password(user_data.pop("password"))
      db.mongo.users.update_one({"username": username}, {"$set": user_data})
      return get_profile(username)
    else:
      raise HTTPException(status_code=400, detail="Can't update external user")

def create_pat(username: str, pat_data: models.PatCreate) -> models.PatCreatedResponse:
    token_prefix = generate_alphanumeric(8)
    token_suffix = generate_alphanumeric(32)
    full_token = f"{config.PAT_STRING_PREFIX}_{token_prefix}_{token_suffix}"
    
    hashed_token = auth.hash_password(full_token)
    
    expires_at = None
    if pat_data.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=pat_data.expires_in_days)
    
    created_at = datetime.now(timezone.utc)

    pat_in_db = models.PatInDB(
        user_id=username,
        name=pat_data.name,
        prefix=token_prefix,
        hashed_token=hashed_token,
        created_at=created_at,
        expires_at=expires_at,
        revoked=False,
        last_used_at=None,
    )
    
    try:
        result = db.mongo.pats.insert_one(pat_in_db.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create PAT: {e}")
    else:
        return models.PatCreatedResponse(
            token=full_token,
        )

def list_pats(username: str) -> List[models.Pat]:
    pats = db.mongo.pats.find({"user_id": username})
    result = []
    for pat in pats:
        pat["id"] = str(pat.pop("_id"))
        result.append(models.Pat(**pat))
    return result

def revoke_pat(username: str, pat_id: str) -> models.Pat:
    try:
        result = db.mongo.pats.update_one({"_id": ObjectId(pat_id), "user_id": username}, {"$set": {"revoked": True}})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revoke PAT: {e}")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="PAT not found")
    
    pat = db.mongo.pats.find_one({"_id": ObjectId(pat_id), "user_id": username})
    pat["id"] = str(pat.pop("_id"))
    return models.Pat(**pat)

def delete_pat(username: str, pat_id: str) -> None:
    try:
        result = db.mongo.pats.delete_one({"_id": ObjectId(pat_id), "user_id": username})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete PAT: {e}")
    else:
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="PAT not found")
        else:
            return {"message": "PAT deleted successfully"}
