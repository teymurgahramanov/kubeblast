import io
import boto3
import logging
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from api.services import jobs
from api.core.config import config

s3_client = boto3.client(
    "s3",
    endpoint_url=config.S3_URL,
    aws_access_key_id=config.S3_ACCESS_KEY,
    aws_secret_access_key=config.S3_SECRET_KEY,
    region_name=config.S3_REGION,  # MinIO does not use regions, but boto3 requires this
)

def create_file(file_content, file_name):
  try:
      s3_client.upload_fileobj(io.BytesIO(file_content), config.S3_BUCKET, file_name)
  except Exception as e:
      logging.error(f"Failed to upload file to S3: {str(e)}")
      raise HTTPException(status_code=500, detail=f"Failed to upload file to S3: {str(e)}")
  
def delete_file(job_id):
    try:
        response = s3_client.list_objects_v2(Bucket=config.S3_BUCKET, Prefix=job_id)

        if 'Contents' in response:
            for obj in response['Contents']:
                file_key = obj['Key']
                s3_client.delete_object(Bucket=config.S3_BUCKET, Key=file_key)
                logging.info(f"Deleted file: {file_key}")
        else:
            logging.warning(f"No files found with prefix '{job_id}' in bucket '{config.S3_BUCKET}'")

    except Exception as e:
        logging.error(f"Failed to delete files from MinIO: {str(e)}")

def read_file(file_name):
    try:
        response = s3_client.get_object(Bucket=config.S3_BUCKET, Key=file_name)
        file_content = response["Body"].read().decode()
        logging.info(f"Read file from S3: {file_name}")
    except Exception as e:
        logging.error(f"Failed to read file from S3: {str(e)}")
        raise HTTPException(status_code=404, detail="Plan file not found.")
    return file_content

def download_file(current_user, job_id, type, download):
    jobs.get_job(current_user, job_id).dict()
    match type:
        case "plan":
            file_name = f"{job_id}.jmx"
            media_type = "application/xml"
        case "report":
            file_name = f"{job_id}.pdf"
            media_type = "application/pdf"
    try:
        response = s3_client.get_object(Bucket=config.S3_BUCKET, Key=file_name)
        content_disposition = f'{"attachment" if download else "inline"}; filename={file_name}'
        logging.info(f"Downloaded file: {file_name}")
        return StreamingResponse(response["Body"], media_type=media_type, headers={"Content-Disposition": content_disposition})
    except Exception as e:
        logging.error(f"Failed to download file: {str(e)}")
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")