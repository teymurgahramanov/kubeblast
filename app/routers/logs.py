from fastapi import APIRouter

router = APIRouter()

@router.get("/logs/{log}")
async def get_log(log: str):
    return {"log": log}