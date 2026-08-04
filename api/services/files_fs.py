import io
import shutil
import zipfile
from pathlib import Path

from config import config
from core.log import logger
from fastapi import HTTPException, Response
from services import jobs

# Convert STORAGE_DIR to Path object
STORAGE_DIR = Path(config.STORAGE_DIR)


def _artifact_path(job_id, file_name):
    if not file_name or Path(file_name).name != file_name or "\\" in file_name:
        raise HTTPException(status_code=400, detail="Invalid artifact filename")
    return STORAGE_DIR / job_id / file_name


def create_file(job_id, file_content, file_name):
    try:
        file_path = _artifact_path(job_id, file_name)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'wb') as f:
            f.write(file_content)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to write file to filesystem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to write file to filesystem: {str(e)}")

def delete_file(job_id):
    try:
        job_dir = STORAGE_DIR / job_id
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.info(f"Deleted job directory: {job_dir}")
    except Exception as e:
        logger.error(f"Failed to delete files from filesystem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete files from filesystem: {str(e)}")

def read_file(job_id, file_name):
    try:
        file_path = _artifact_path(job_id, file_name)
        with open(file_path, 'r') as f:
            file_content = f.read()
        logger.info(f"Read file from filesystem: {file_name}")
    except Exception as e:
        logger.error(f"Failed to read file from filesystem: {str(e)}")
        raise HTTPException(status_code=404, detail="Plan file not found.")
    return file_content

def download_file(current_user, job_id, type, path=None):
    job = jobs.get_job(current_user, job_id).dict()
    match type:
        case "plan":
            file_path = STORAGE_DIR / job_id / "plan.jmx"
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                return Response(
                    content=content,
                    media_type="application/xml",
                    headers={
                        "Content-Disposition": "inline;"
                    }
                )
            except Exception as e:
                logger.error(f"Failed to read plan from filesystem: {str(e)}")
                raise HTTPException(status_code=404, detail="Plan file not found.")
        case "result":
            file_path = STORAGE_DIR / job_id / "result.jtl"
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                return Response(
                    content=content,
                    media_type="text/plain",
                    headers={
                        "Content-Disposition": f'attachment; filename="kb-{job["name"]}-result.jtl"'
                    }
                )
            except Exception as e:
                logger.error(f"Failed to read result from filesystem: {str(e)}")
                raise HTTPException(status_code=404, detail="Result file not found.") 
        case "report":
            report_dir = (STORAGE_DIR / job_id / "report")
            try:
                if not report_dir.is_dir():
                    raise HTTPException(status_code=404, detail="Report directory not found.")

                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    for file_path in report_dir.rglob("*"):
                        if file_path.is_file():
                            arcname = file_path.relative_to(report_dir)
                            zf.write(file_path, arcname)
                buf.seek(0)

                zip_name = f"kb-{job['name']}-report.zip"
                return Response(
                    content=buf.getvalue(),
                    media_type="application/zip",
                    headers={
                        "Content-Disposition": f'attachment; filename="{zip_name}"'
                    }
                )
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to create report zip: {str(e)}")
                raise HTTPException(status_code=404, detail="Report not found.")