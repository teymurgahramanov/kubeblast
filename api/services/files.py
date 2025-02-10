import os
import io
import boto3
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from api.services import jobs
from api.core.config import config
from api.core import s3

def create_file(file_content, file_name):
  # Upload file to MinIO (S3)
  try:
      s3.client.upload_fileobj(io.BytesIO(file_content), config.S3_BUCKET, file_name)
  except Exception as e:
      raise HTTPException(status_code=500, detail=f"Failed to upload file to S3: {str(e)}")
  
def delete_file(file_name):
  try:
      s3.client.delete_object(Bucket=config.S3_BUCKET, Key=file_name)
      print(f"File {file_name} deleted from MinIO")
  except Exception as e:
      print(f"Failed to delete file from MinIO: {str(e)}")

def read_file(file_name):
    try:
        response = s3.client.get_object(Bucket=config.S3_BUCKET, Key=file_name)
        file_content = response["Body"].read().decode()
    except Exception as e:
        print(e)
        raise HTTPException(status_code=404, detail="Plan file not found.")
    return file_content

def download_file(current_user, job_id, type, download):
    job = jobs.get_job(current_user, job_id).dict()
    match type:
        case "plan":
            file_name = f"{job['name']}.jmx"
            media_type = "application/xml"
        case "report":
            file_name = f"{job['name']}.pdf"
            media_type = "application/pdf"
    try:
        response = s3.client.get_object(Bucket=config.S3_BUCKET, Key=file_name)
        content_disposition = f'{"attachment" if download else "inline"}; filename={file_name}'
        return StreamingResponse(response["Body"], media_type=media_type, headers={"Content-Disposition": content_disposition})
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")