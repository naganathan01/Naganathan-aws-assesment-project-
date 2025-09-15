import boto3
import time
import json
import sys
from botocore.exceptions import ClientError

def create_backend_bucket(prefix="naganathan-aws-devops-terraform-state", region="us-west-2"):
    # Generate unique bucket name
    bucket_name = f"{prefix}-{int(time.time())}"
    s3 = boto3.client("s3", region_name=region)

    print(f"Creating S3 bucket for Terraform backend: {bucket_name}")

    try:
        # Create S3 bucket (region-specific)
        if region == "us-east-1":
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": region},
            )

        # Enable versioning
        s3.put_bucket_versioning(
            Bucket=bucket_name,
            VersioningConfiguration={"Status": "Enabled"}
        )

        # Enable encryption
        s3.put_bucket_encryption(
            Bucket=bucket_name,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }
        )

        # Block public access
        s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True
            }
        )

        print(f"✅ Backend S3 bucket created: {bucket_name}\n")
        print("📝 Update terraform/main.tf backend configuration with this bucket name:\n")
        print('backend "s3" {')
        print(f'  bucket = "{bucket_name}"')
        print('  key    = "infrastructure/terraform.tfstate"')
        print(f'  region = "{region}"')
        print("}")

        return bucket_name

    except ClientError as e:
        print(f"❌ Error creating bucket: {e}")
        sys.exit(1)


if __name__ == "__main__":
    create_backend_bucket()
