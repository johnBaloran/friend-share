# AWS Elastic Beanstalk Deployment Guide

## Architecture Overview

This application uses **separate deployments** for API and Workers:

```
┌─────────────────┐     ┌──────────────────┐
│   API Server    │     │  Worker Process  │
│  (Web Tier)     │     │  (Worker Tier)   │
│                 │     │                  │
│  - HTTP API     │     │  - Face Detection│
│  - Port 3001    │     │  - Face Grouping │
│  - t3.small     │     │  - Cleanup Jobs  │
│                 │     │  - t3.medium     │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         │     ┌─────────────────┼──────────┐
         │     │                 │          │
         └─────┤   Shared Resources         │
               │                            │
               │  • MongoDB (Database)      │
               │  • Redis (Job Queue)       │
               │  • S3 (File Storage)       │
               │  • Rekognition (AI)        │
               └────────────────────────────┘
```

## Prerequisites

1. **AWS CLI** installed and configured
2. **EB CLI** installed: `pip install awsebcli`
3. **Environment variables** ready (MongoDB URI, Redis URL, AWS credentials)
4. **Domain/DNS** configured (optional)

## Initial Setup

### 1. Initialize Elastic Beanstalk (First Time Only)

```bash
cd backend

# Initialize EB (creates .elasticbeanstalk/ directory)
eb init

# Select options:
# - Region: us-east-1 (or your preferred region)
# - Application name: face-media-sharing
# - Platform: Node.js
# - Platform version: Node.js 18 running on 64bit Amazon Linux 2
# - SSH: Yes (recommended for debugging)
```

## Deployment Steps

### Step 1: Deploy API Server (Web Tier)

```bash
cd backend

# Build TypeScript
npm run build

# Create API environment (first time only)
eb create face-media-api \
  --instance-type t3.small \
  --envvars NODE_ENV=production,PORT=8080

# Or deploy to existing environment
eb deploy face-media-api

# Set environment variables
eb setenv \
  MONGODB_URI="your-mongodb-connection-string" \
  REDIS_URL="your-redis-url" \
  AWS_ACCESS_KEY_ID="your-aws-access-key" \
  AWS_SECRET_ACCESS_KEY="your-aws-secret-key" \
  AWS_REGION="us-east-1" \
  AWS_S3_BUCKET_NAME="your-bucket-name" \
  AWS_REKOGNITION_COLLECTION_PREFIX="face-media" \
  CLERK_PUBLISHABLE_KEY="your-clerk-key" \
  CLERK_SECRET_KEY="your-clerk-secret" \
  CORS_ORIGIN="https://your-frontend-domain.com" \
  -e face-media-api
```

### Step 2: Deploy Worker Process (Worker Tier)

```bash
cd backend

# Build TypeScript (if not already built)
npm run build

# Copy worker-specific Procfile
cp Procfile.worker Procfile

# Create Worker environment (first time only)
eb create face-media-workers \
  --instance-type t3.medium \
  --envvars NODE_ENV=production

# Or deploy to existing environment
eb deploy face-media-workers

# Set environment variables (same as API)
eb setenv \
  MONGODB_URI="your-mongodb-connection-string" \
  REDIS_URL="your-redis-url" \
  AWS_ACCESS_KEY_ID="your-aws-access-key" \
  AWS_SECRET_ACCESS_KEY="your-aws-secret-key" \
  AWS_REGION="us-east-1" \
  AWS_S3_BUCKET_NAME="your-bucket-name" \
  AWS_REKOGNITION_COLLECTION_PREFIX="face-media" \
  -e face-media-workers

# Restore API Procfile
cp Procfile.api Procfile  # Or git checkout Procfile
```

## Environment Variables

Both environments need these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `REDIS_URL` | Redis connection URL | `redis://user:pass@redis-host:6379` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | `...` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | `face-media-uploads` |
| `AWS_REKOGNITION_COLLECTION_PREFIX` | Rekognition prefix | `face-media` |
| `CLERK_PUBLISHABLE_KEY` | Clerk auth key | `pk_...` |
| `CLERK_SECRET_KEY` | Clerk secret | `sk_...` |
| `CORS_ORIGIN` | Frontend URL | `https://yourapp.com` |

**API-only variables:**
- `PORT` - API server port (default: `8080` for EB)

## Quick Deploy Script

Create `backend/deploy.sh`:

```bash
#!/bin/bash

echo "Building TypeScript..."
npm run build

echo ""
echo "Deploying API..."
cp Procfile Procfile.bak
eb deploy face-media-api

echo ""
echo "Deploying Workers..."
cp Procfile.worker Procfile
eb deploy face-media-workers
cp Procfile.bak Procfile
rm Procfile.bak

echo ""
echo "✅ Deployment complete!"
echo "API: $(eb status face-media-api | grep CNAME)"
echo "Workers: Running in background"
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Monitoring

### Check API Status
```bash
eb status face-media-api
eb health face-media-api
eb logs face-media-api
```

### Check Worker Status
```bash
eb status face-media-workers
eb health face-media-workers
eb logs face-media-workers  # See worker processing logs
```

### Watch Worker Logs in Real-Time
```bash
eb logs face-media-workers --stream
```

You should see:
```
[Face Detection] Starting job...
✅ [face-detection] Job completed
[Face Grouping] Starting job...
✅ [face-grouping] Job completed
```

## Scaling

### Scale API (Handle more HTTP requests)
```bash
# Enable auto-scaling (recommended)
eb config face-media-api
# Set: Min instances: 1, Max instances: 5

# Or manual scaling
eb scale 3 face-media-api  # Run 3 instances
```

### Scale Workers (Process more jobs)
```bash
# Scale workers for heavy processing
eb scale 2 face-media-workers  # Run 2 worker instances
```

## Troubleshooting

### API not responding
```bash
eb ssh face-media-api
pm2 logs  # If using PM2
journalctl -u web  # Check systemd logs
```

### Workers not processing jobs
```bash
eb ssh face-media-workers
# Check if worker is running
ps aux | grep node

# Check worker logs
tail -f /var/log/nodejs/nodejs.log
```

### Redis connection issues
- Ensure Redis is accessible from both environments
- Check security groups allow connections
- Verify REDIS_URL is correct

### MongoDB connection issues
- Whitelist Elastic Beanstalk IPs in MongoDB Atlas
- Check MONGODB_URI format
- Ensure network access is configured

## Updating Environment

### Update API code
```bash
cd backend
npm run build
eb deploy face-media-api
```

### Update Worker code
```bash
cd backend
npm run build
cp Procfile.worker Procfile
eb deploy face-media-workers
git checkout Procfile  # Restore API Procfile
```

### Update environment variables
```bash
# Update both environments
eb setenv NEW_VAR="value" -e face-media-api
eb setenv NEW_VAR="value" -e face-media-workers
```

## Cost Optimization

### Development
- Use `t3.micro` for API
- Use `t3.small` for workers
- Single instance for both

### Production
- API: `t3.small` with auto-scaling (1-5 instances)
- Workers: `t3.medium` with manual scaling (2-3 instances)
- Enable spot instances for workers (50-70% cost savings)

## Health Checks

API health check is automatic (HTTP endpoint).

For workers, EB monitors the process. If worker crashes, it auto-restarts.

## Cleanup

```bash
# Terminate environments
eb terminate face-media-api
eb terminate face-media-workers

# Delete application
eb terminate --all
```

## Next Steps

1. Set up **CloudWatch** alarms for CPU/memory
2. Configure **auto-scaling** policies
3. Set up **CloudWatch Logs** for centralized logging
4. Enable **X-Ray** for distributed tracing
5. Configure **RDS** for production database
6. Set up **ElastiCache** for production Redis

---

## Quick Reference

```bash
# Status
eb status

# Logs
eb logs --stream

# SSH
eb ssh

# Open in browser
eb open

# Health
eb health

# Config
eb config

# Environment info
eb printenv
```
