import boto3
from api.core.config import config

client = boto3.client(
    "s3",
    endpoint_url=config.S3_URL,
    aws_access_key_id=config.S3_ACCESS_KEY,
    aws_secret_access_key=config.S3_SECRET_KEY,
    region_name=config.S3_REGION,  # MinIO does not use regions, but boto3 requires this
)