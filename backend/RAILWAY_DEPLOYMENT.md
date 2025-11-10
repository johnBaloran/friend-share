# Railway Deployment Guide

This guide covers deploying the Face Media Sharing backend (API + Worker) to Railway.

## Prerequisites

- Railway account (https://railway.app)
- Railway CLI (optional): `npm install -g @railway/cli`
- Redis instance (Upstash or Railway Redis)
- MongoDB instance (MongoDB Atlas or Railway MongoDB)
- AWS Account with S3 and Rekognition configured

## Deployment Options

### Option 1: Single Service (API + Worker Together) ✅ Recommended

This runs both the API server and background worker in a single Railway service.

**Pros:**
- Simpler setup
- One service to manage
- Lower cost

**Cons:**
- Both processes share resources
- If one crashes, both restart

### Option 2: Separate Services (API and Worker)

Run API and Worker as separate Railway services for better scaling and isolation.

## Quick Deploy - Single Service

### 1. **Create New Project in Railway**

```bash
# Option A: Using Railway CLI
railway login
railway init
railway link

# Option B: Connect via GitHub
# Push your code to GitHub, then connect the repo in Railway dashboard
```

### 2. **Configure Environment Variables**

In Railway dashboard, add these variables:

```env
# Server
NODE_ENV=production
PORT=3001

# Database
MONGODB_URI=your_mongodb_connection_string

# Redis (for BullMQ)
REDIS_URL=your_redis_connection_string

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-2
AWS_S3_BUCKET_NAME=your_s3_bucket_name
AWS_REKOGNITION_COLLECTION_PREFIX=face-media-group

# App Configuration
MAX_FILE_SIZE=10485760
MAX_FILES_PER_UPLOAD=50
ENABLE_RATE_LIMITING=true
ENABLE_PERFORMANCE_MONITORING=true

# CORS (your frontend URL)
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Optional: Sentry (for error tracking)
SENTRY_DSN=your_sentry_dsn
```

### 3. **Deploy**

Railway will automatically:
1. Detect Node.js
2. Run `npm install`
3. Run `npm run build` (compiles TypeScript)
4. Run `npm run start:all` (starts both API and worker)

### 4. **Verify Deployment**

Check the logs in Railway dashboard:
```
✅ API Server and Worker started successfully
🚀 Server is running on port 3001
[Worker] Connected to Redis
[Worker] Face detection worker started
[Worker] Face grouping worker started
```

### 5. **Get Your API URL**

Railway will provide a public URL like:
```
https://your-service-name.up.railway.app
```

Use this as your `NEXT_PUBLIC_API_URL` in Vercel.

## Separate Services Deployment

If you want to deploy API and Worker separately:

### Service 1: API Server

**Start Command:**
```bash
npm run start
```

**Environment Variables:** Same as above

### Service 2: Worker

**Start Command:**
```bash
npm run start:worker
```

**Environment Variables:** Same as above (both need access to MongoDB, Redis, AWS)

## Adding Redis to Railway

1. Click "New" → "Database" → "Add Redis"
2. Copy the `REDIS_URL` connection string
3. Add it to your environment variables

## Adding MongoDB to Railway

1. Click "New" → "Database" → "Add MongoDB"
2. Copy the `MONGO_URL` connection string
3. Add it as `MONGODB_URI` in environment variables

## Health Check

Test your deployment:

```bash
curl https://your-service-name.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Monitoring

### View Logs
```bash
railway logs
```

### View Metrics
- CPU usage
- Memory usage
- Request rate

All available in Railway dashboard.

## Troubleshooting

### Worker Not Processing Jobs

1. **Check Redis Connection:**
   ```
   Verify REDIS_URL is set correctly
   Check Redis is accessible from Railway
   ```

2. **Check Worker Logs:**
   ```
   Look for "[Worker] Connected to Redis"
   Check for any error messages
   ```

### API Server Not Starting

1. **Check Port:**
   ```
   Railway automatically sets PORT variable
   Make sure your Express app uses process.env.PORT
   ```

2. **Check MongoDB Connection:**
   ```
   Verify MONGODB_URI is correct
   Check MongoDB allows Railway IPs
   ```

### Build Failures

1. **TypeScript Errors:**
   ```bash
   npm run typecheck
   # Fix any type errors before deploying
   ```

2. **Dependencies:**
   ```bash
   npm install
   # Ensure all dependencies are in package.json
   ```

## Scaling

### Vertical Scaling
Upgrade your Railway plan for more CPU/memory

### Horizontal Scaling
Deploy multiple worker services:
1. Create additional services with `start:worker`
2. They'll automatically share the job queue via Redis
3. Scale workers independently of API

## Cost Optimization

- **Free Tier:** $5 credit/month (suitable for testing)
- **Hobby Plan:** $5/month + usage (recommended)
- **Pro Plan:** For production with high traffic

## CI/CD

Railway automatically deploys on git push:

1. Push to your main branch
2. Railway detects changes
3. Runs build
4. Deploys automatically

## Rollback

If deployment fails:
```bash
railway rollback
```

Or use Railway dashboard to rollback to previous deployment.

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Get Railway API URL
3. ✅ Update Vercel environment variable `NEXT_PUBLIC_API_URL`
4. ✅ Test end-to-end: Upload photos → Face detection → Clustering

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app
