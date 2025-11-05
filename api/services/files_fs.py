import shutil
from pathlib import Path
from fastapi import HTTPException, Response
from core.log import logger
from config import config
from services import jobs

# Convert STORAGE_DIR to Path object
STORAGE_DIR = Path(config.STORAGE_DIR)

def create_file(job_id, file_content, file_name):
    try:
        file_path = STORAGE_DIR / job_id / file_name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'wb') as f:
            f.write(file_content)
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
        file_path = STORAGE_DIR / job_id / file_name
        with open(file_path, 'r') as f:
            file_content = f.read()
        logger.info(f"Read file from filesystem: {file_name}")
    except Exception as e:
        logger.error(f"Failed to read file from filesystem: {str(e)}")
        raise HTTPException(status_code=404, detail="Plan file not found.")
    return file_content

def download_file(current_user, job_id, type):
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
                        "Content-Disposition": f'attachment; filename="{job["name"]}.jtl"'
                    }
                )
            except Exception as e:
                logger.error(f"Failed to read result from filesystem: {str(e)}")
                raise HTTPException(status_code=404, detail="Result file not found.") 