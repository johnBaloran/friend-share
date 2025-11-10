#!/bin/bash

# MongoDB Database Backup Script
# This script creates a backup of the MongoDB database and uploads it to S3

# Load environment variables
if [ -f ../.env ]; then
  export $(cat ../.env | grep -v '^#' | xargs)
fi

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backup_${TIMESTAMP}"
BACKUP_DIR="/tmp/mongodb_backups"
S3_BUCKET="${AWS_S3_BACKUP_BUCKET:-face-media-backups}"
S3_PREFIX="database-backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "🚀 Starting MongoDB backup..."
echo "Timestamp: ${TIMESTAMP}"
echo "Backup directory: ${BACKUP_DIR}/${BACKUP_NAME}"

# Extract database name from MongoDB URI
DB_NAME=$(echo ${MONGODB_URI} | sed 's/.*\/\([^?]*\).*/\1/')

# Perform mongodump
mongodump \
  --uri="${MONGODB_URI}" \
  --out="${BACKUP_DIR}/${BACKUP_NAME}" \
  --gzip

if [ $? -ne 0 ]; then
  echo "❌ MongoDB backup failed!"
  exit 1
fi

echo "✅ MongoDB backup completed successfully"

# Create a tarball of the backup
echo "📦 Creating compressed archive..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"

if [ $? -ne 0 ]; then
  echo "❌ Failed to create compressed archive!"
  exit 1
fi

echo "✅ Compressed archive created"

# Upload to S3 (if AWS CLI is configured)
if command -v aws &> /dev/null; then
  echo "☁️  Uploading backup to S3..."

  aws s3 cp \
    "${BACKUP_NAME}.tar.gz" \
    "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_NAME}.tar.gz" \
    --region "${AWS_REGION:-us-east-1}" \
    --storage-class STANDARD_IA

  if [ $? -eq 0 ]; then
    echo "✅ Backup uploaded to S3: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_NAME}.tar.gz"

    # Clean up local backup after successful upload
    rm -rf "${BACKUP_DIR}/${BACKUP_NAME}"
    rm "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo "🧹 Local backup files cleaned up"
  else
    echo "⚠️  Failed to upload to S3, keeping local backup"
  fi

  # Clean up old backups from S3 (older than retention period)
  echo "🧹 Cleaning up old S3 backups (older than ${RETENTION_DAYS} days)..."

  CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)

  aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
    BACKUP_DATE=$(echo $line | awk '{print $1}')
    BACKUP_FILE=$(echo $line | awk '{print $4}')

    if [[ "$BACKUP_DATE" < "$CUTOFF_DATE" ]]; then
      echo "Deleting old backup: ${BACKUP_FILE}"
      aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"
    fi
  done

  echo "✅ Old backups cleaned up"
else
  echo "⚠️  AWS CLI not found, skipping S3 upload"
  echo "Local backup saved at: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
fi

echo "✨ Backup process completed!"
echo "Backup size: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" 2>/dev/null | cut -f1 || echo "N/A")"

# Optional: Send notification (webhook, email, etc.)
if [ ! -z "${BACKUP_NOTIFICATION_WEBHOOK}" ]; then
  curl -X POST "${BACKUP_NOTIFICATION_WEBHOOK}" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Database backup completed: ${BACKUP_NAME}\", \"timestamp\": \"${TIMESTAMP}\"}"
fi

exit 0
