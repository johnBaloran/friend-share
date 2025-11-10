#!/bin/bash

# MongoDB Database Restore Script
# This script restores a MongoDB database from a backup

# Load environment variables
if [ -f ../.env ]; then
  export $(cat ../.env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="/tmp/mongodb_backups"
S3_BUCKET="${AWS_S3_BACKUP_BUCKET:-face-media-backups}"
S3_PREFIX="database-backups"

# Check if backup name is provided
if [ -z "$1" ]; then
  echo "❌ Error: Backup name is required!"
  echo "Usage: ./restore-database.sh <backup_name>"
  echo ""
  echo "Available backups:"

  if command -v aws &> /dev/null; then
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | grep ".tar.gz" | awk '{print $4}'
  else
    echo "AWS CLI not found. Please install it to list S3 backups."
    echo "Or provide the backup filename if you have it locally."
  fi

  exit 1
fi

BACKUP_NAME="$1"
BACKUP_FILE="${BACKUP_NAME}.tar.gz"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "🚀 Starting MongoDB restore..."
echo "Backup: ${BACKUP_NAME}"

# Check if backup exists locally
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
  echo "✅ Found local backup"
else
  # Download from S3
  if command -v aws &> /dev/null; then
    echo "☁️  Downloading backup from S3..."

    aws s3 cp \
      "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" \
      "${BACKUP_DIR}/${BACKUP_FILE}" \
      --region "${AWS_REGION:-us-east-1}"

    if [ $? -ne 0 ]; then
      echo "❌ Failed to download backup from S3!"
      exit 1
    fi

    echo "✅ Backup downloaded from S3"
  else
    echo "❌ Backup not found locally and AWS CLI not available!"
    exit 1
  fi
fi

# Extract the backup
echo "📦 Extracting backup archive..."
cd "${BACKUP_DIR}"
tar -xzf "${BACKUP_FILE}"

if [ $? -ne 0 ]; then
  echo "❌ Failed to extract backup archive!"
  exit 1
fi

echo "✅ Backup extracted"

# Extract database name from MongoDB URI
DB_NAME=$(echo ${MONGODB_URI} | sed 's/.*\/\([^?]*\).*/\1/')

# Confirm restore
echo "⚠️  WARNING: This will replace the current database '${DB_NAME}'"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 1
fi

# Perform mongorestore
echo "🔄 Restoring database..."

mongorestore \
  --uri="${MONGODB_URI}" \
  --gzip \
  --drop \
  --dir="${BACKUP_DIR}/${BACKUP_NAME}/${DB_NAME}"

if [ $? -ne 0 ]; then
  echo "❌ MongoDB restore failed!"
  exit 1
fi

echo "✅ Database restored successfully"

# Clean up
rm -rf "${BACKUP_DIR}/${BACKUP_NAME}"
echo "🧹 Cleanup completed"

echo "✨ Restore process completed successfully!"

exit 0
