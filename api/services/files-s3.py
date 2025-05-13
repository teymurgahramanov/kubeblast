import io
import boto3
from core.log import logger
import zipfile
from fastapi import HTTPException, Response 
from fastapi.responses import StreamingResponse, HTMLResponse, RedirectResponse
from config import config
from services import jobs

s3_client = boto3.client(
    "s3",
    endpoint_url=config.S3_URL,
    aws_access_key_id=config.S3_ACCESS_KEY,
    aws_secret_access_key=config.S3_SECRET_KEY,
    region_name=config.S3_REGION,
)

def create_file(job_id, file_content, file_name):
    try:
        s3_client.upload_fileobj(io.BytesIO(file_content), config.S3_BUCKET, f"{job_id}/{file_name}")
    except Exception as e:
        logger.error(f"Failed to upload file to S3: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file to S3: {str(e)}")
  
def delete_file(job_id):
    try:
        response = s3_client.list_objects_v2(Bucket=config.S3_BUCKET, Prefix=job_id)

        if 'Contents' in response:
            for obj in response['Contents']:
                file_key = obj['Key']
                s3_client.delete_object(Bucket=config.S3_BUCKET, Key=file_key)
                logger.info(f"Deleted file: {file_key}")
        else:
            logger.warning(f"No files found with prefix '{job_id}' in bucket '{config.S3_BUCKET}'")

    except Exception as e:
        logger.error(f"Failed to delete files from Object Storage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete files from Object Storage: {str(e)}")

def read_file(job_id, file_name):
    try:
        response = s3_client.get_object(Bucket=config.S3_BUCKET, Key=f"{job_id}/{file_name}")
        file_content = response["Body"].read().decode()
        logger.info(f"Read file from S3: {file_name}")
    except Exception as e:
        logger.error(f"Failed to read file from S3: {str(e)}")
        raise HTTPException(status_code=404, detail="Plan file not found.")
    return file_content

def download_file(current_user, job_id, type):
    job = jobs.get_job(current_user, job_id).dict()
    match type:
        case "plan":
            file_name = f"{job_id}/plan.jmx"
            try:
                response = s3_client.get_object(Bucket=config.S3_BUCKET, Key=file_name)
                content = response['Body'].read().decode()
                return Response(
                    content=content,
                    media_type="application/xml",
                    headers={
                        "Content-Disposition": "inline;"
                    }
                )
            except Exception as e:
                logger.error(f"Failed to read plan from S3: {str(e)}")
                raise HTTPException(status_code=404, detail="Plan file not found.")
        case "report":
            try:
                # List all objects with the report prefix
                response = s3_client.list_objects_v2(Bucket=config.S3_BUCKET, Prefix=f"{job_id}/report")
                
                if 'Contents' not in response:
                    raise HTTPException(status_code=404, detail="No report files found")
                    
                # Create a zip file in memory
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                    for obj in response['Contents']:
                        file_key = obj['Key']
                        # Get the relative path within the zip
                        relative_path = file_key.replace(f"{job_id}/report/", "", 1)
                        # Download the file from S3
                        response = s3_client.get_object(Bucket=config.S3_BUCKET, Key=file_key)
                        file_content = response['Body'].read()
                        # Add file to zip
                        zip_file.writestr(relative_path, file_content)
                
                return Response(
                    content=zip_buffer.getvalue(),
                    media_type="application/zip",
                    headers={
                        "Content-Disposition": f'attachment; filename="{job["name"]}.zip"'
                    }
                )
            except HTTPException as e:
                raise e
            except Exception as e:
                logger.error(f"Failed to create report zip: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to create report zip: {str(e)}")