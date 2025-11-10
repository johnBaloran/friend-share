# Database Backup Configuration

This directory contains scripts for backing up and restoring the MongoDB database.

## Prerequisites

1. **MongoDB Database Tools** - Install mongodump and mongorestore:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb-database-tools

   # macOS
   brew install mongodb-database-tools

   # Windows
   # Download from: https://www.mongodb.com/try/download/database-tools
   ```

2. **AWS CLI** (optional, for S3 backups):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install awscli

   # macOS
   brew install awscli

   # Windows
   # Download from: https://aws.amazon.com/cli/
   ```

3. **AWS Credentials** (if using S3):
   ```bash
   aws configure
   ```

## Environment Variables

Add these to your `.env` file:

```env
# Existing MongoDB connection
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database

# Backup configuration
AWS_S3_BACKUP_BUCKET=face-media-backups
BACKUP_RETENTION_DAYS=30
BACKUP_NOTIFICATION_WEBHOOK=https://hooks.slack.com/... (optional)
```

## Scripts

### 1. backup-database.sh

Creates a compressed backup of the MongoDB database and uploads it to S3.

**Usage:**
```bash
cd backend/scripts
chmod +x backup-database.sh
./backup-database.sh
```

**What it does:**
- Creates a mongodump of the database
- Compresses the backup as a .tar.gz file
- Uploads to S3 (if AWS CLI is configured)
- Cleans up old backups (older than retention period)
- Sends notification webhook (if configured)

### 2. restore-database.sh

Restores the database from a backup.

**Usage:**
```bash
cd backend/scripts
chmod +x restore-database.sh
./restore-database.sh backup_20240101_120000
```

**What it does:**
- Downloads backup from S3 (if needed)
- Extracts the compressed backup
- Restores the database using mongorestore
- Prompts for confirmation before restoring

## Automated Backups with Cron

### Linux/macOS

1. Open crontab editor:
   ```bash
   crontab -e
   ```

2. Add a cron job (example: daily at 2 AM):
   ```cron
   0 2 * * * /path/to/backend/scripts/backup-database.sh >> /var/log/mongodb-backup.log 2>&1
   ```

3. Common cron schedules:
   ```cron
   # Every day at 2 AM
   0 2 * * * /path/to/script.sh

   # Every 6 hours
   0 */6 * * * /path/to/script.sh

   # Every Sunday at 3 AM
   0 3 * * 0 /path/to/script.sh

   # Every hour
   0 * * * * /path/to/script.sh
   ```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create a new task
3. Set trigger (e.g., daily at 2 AM)
4. Set action: Run `bash backup-database.sh` (requires Git Bash or WSL)

## S3 Bucket Setup

1. **Create S3 Bucket:**
   ```bash
   aws s3 mb s3://face-media-backups --region us-east-1
   ```

2. **Enable Versioning (optional but recommended):**
   ```bash
   aws s3api put-bucket-versioning \
     --bucket face-media-backups \
     --versioning-configuration Status=Enabled
   ```

3. **Set Lifecycle Policy (auto-delete old backups):**

   Create a file `lifecycle-policy.json`:
   ```json
   {
     "Rules": [
       {
         "Id": "DeleteOldBackups",
         "Status": "Enabled",
         "Prefix": "database-backups/",
         "Expiration": {
           "Days": 90
         },
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "GLACIER"
           }
         ]
       }
     ]
   }
   ```

   Apply the policy:
   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket face-media-backups \
     --lifecycle-configuration file://lifecycle-policy.json
   ```

## Monitoring and Alerts

### Slack Notifications

Set the `BACKUP_NOTIFICATION_WEBHOOK` environment variable to receive Slack notifications:

```env
BACKUP_NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### CloudWatch Alarms (AWS)

If running on AWS, you can set up CloudWatch alarms to monitor backup success/failure.

## Best Practices

1. **Test Restores Regularly** - Verify backups can be restored successfully
2. **Multiple Locations** - Store backups in multiple regions or services
3. **Encryption** - Enable encryption for S3 buckets
4. **Access Control** - Use IAM policies to restrict access to backups
5. **Monitoring** - Set up alerts for backup failures
6. **Documentation** - Keep this README updated with any changes

## Backup Frequency Recommendations

- **Production:** Daily backups + hourly incremental (if critical)
- **Staging:** Daily backups
- **Development:** Weekly backups (or on-demand)

## Restore Process

1. **List available backups:**
   ```bash
   aws s3 ls s3://face-media-backups/database-backups/
   ```

2. **Restore from backup:**
   ```bash
   ./restore-database.sh backup_20240101_120000
   ```

3. **Verify restoration:**
   - Check database records
   - Test application functionality
   - Verify data integrity

## Troubleshooting

### Backup fails with "command not found"
- Install MongoDB Database Tools
- Ensure they're in your PATH

### S3 upload fails
- Check AWS credentials: `aws sts get-caller-identity`
- Verify S3 bucket exists and you have permissions
- Check network connectivity

### Restore overwrites wrong database
- Always verify `MONGODB_URI` before restoring
- The script extracts the database name from the URI
- Use confirmation prompt before proceeding

## Security Considerations

1. **Encrypt backups** - Use S3 encryption or encrypt before upload
2. **Secure credentials** - Never commit `.env` files
3. **Limit access** - Use IAM roles with minimal permissions
4. **Audit logs** - Enable CloudTrail for S3 access logging
5. **Test restores** - Regularly verify backup integrity

## Cost Optimization

- Use S3 Intelligent-Tiering or Glacier for long-term storage
- Delete old backups automatically (lifecycle policy)
- Compress backups before upload (already done in script)
- Monitor S3 storage costs in AWS Cost Explorer
