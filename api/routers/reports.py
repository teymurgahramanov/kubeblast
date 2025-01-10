from fastapi import APIRouter

router = APIRouter()

@router.get("/reports/{report}")
async def get_report(report: str):
    return {"report": report}