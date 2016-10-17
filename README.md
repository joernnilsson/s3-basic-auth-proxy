# s3-basic-auth-proxy
List files in a S3 bucket and download. Protected by http basic auth.

## Configuration
Configured through environment variables
* S3_BUCKET: S3 bucket name
* S3_REGION: S3 region (for endpoint seleciton)
* AWS_ACCESS_KEY_ID: Aws key id
* AWS_SECRET_ACCESS_KEY: Aws secret key
* AUTH_USER: The basic auth username to validate against
* AUTH_PASSWORD: The basic auth password to validate against

## Assumes bucket layout:
releases/projectname-1.3.2.zip

snapshots/projectname-1.3.2.branchname.2016-10-17.COMMIT-HASH.zip
