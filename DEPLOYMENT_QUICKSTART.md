# Deployment Quick Start

## ✅ Worker Migration Complete!

Workers have been successfully migrated to `backend/src/workers/`. You can now deploy API and Workers separately on AWS Elastic Beanstalk.

## Local Development

### Running Locally

**Terminal 1 - API Server:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Worker Process:**
```bash
cd backend
npm run worker:dev
```

**Terminal 3 - Frontend:**
```bash
npm run dev
```

Upload photos and watch the worker logs process face detection!

---

## Production Deployment (AWS Elastic Beanstalk)

### Architecture

```
API Server (Web Tier)          Worker Process (Worker Tier)
├─ HTTP API                    ├─ Face Detection Jobs
├─ Port 3001/8080              ├─ Face Grouping Jobs
├─ Instance: t3.small          ├─ Cleanup Jobs
└─ Auto-scaling: 1-5           └─ Instance: t3.medium

        ↓                               ↓
    ┌───────────────────────────────────────┐
    │       Shared Resources                │
    │  • MongoDB (Database)                 │
    │  • Redis (Job Queue - BullMQ)         │
    │  • S3 (File Storage)                  │
    │  • Rekognition (Face Detection AI)    │
    └───────────────────────────────────────┘
```

### Prerequisites

1. Install EB CLI:
   ```bash
   pip install awsebcli
   ```

2. Configure AWS credentials:
   ```bash
   aws configure
   ```

3. Have your environment variables ready:
   - MongoDB connection string
   - Redis URL (Upstash or AWS ElastiCache)
   - AWS credentials
   - Clerk auth keys
   - S3 bucket name

### Quick Deploy

```bash
cd backend

# Make deploy script executable
chmod +x deploy.sh

# Deploy both API and Workers
./deploy.sh
```

That's it! The script will:
1. Build TypeScript
2. Deploy API server
3. Deploy Worker process
4. Show you the API URL

### First-Time Setup

If this is your first deployment, initialize first:

```bash
cd backend

# Initialize EB
eb init
# Select: Node.js platform, your region, SSH yes

# Create API environment
eb create face-media-api --instance-type t3.small

# Create Worker environment
eb create face-media-workers --instance-type t3.medium

# Set environment variables for BOTH
eb setenv \
  MONGODB_URI="mongodb+srv://..." \
  REDIS_URL="redis://..." \
  AWS_ACCESS_KEY_ID="..." \
  AWS_SECRET_ACCESS_KEY="..." \
  AWS_REGION="us-east-1" \
  AWS_S3_BUCKET_NAME="your-bucket" \
  AWS_REKOGNITION_COLLECTION_PREFIX="face-media" \
  CLERK_PUBLISHABLE_KEY="pk_..." \
  CLERK_SECRET_KEY="sk_..." \
  -e face-media-api

# Same for workers
eb setenv <same vars> -e face-media-workers

# Now deploy
./deploy.sh
```

### Monitoring

**Check API status:**
```bash
eb status face-media-api
eb logs face-media-api --stream
```

**Check Worker status:**
```bash
eb status face-media-workers
eb logs face-media-workers --stream
```

Worker logs will show:
```
[Face Detection] Starting job...
[Face Detection] Detected 3 faces
[Face Detection] Enhanced 3 faces
✅ [face-detection] Job completed

[Face Grouping] Starting job...
[Face Grouping] Clustering 40 faces...
✅ [face-grouping] Job completed
```

### Scaling

**Scale API for more traffic:**
```bash
eb scale 3 face-media-api  # Run 3 instances
```

**Scale Workers for faster processing:**
```bash
eb scale 2 face-media-workers  # Run 2 worker instances
```

---

## Files Created

```
backend/
├── src/
│   └── workers/
│       ├── index.ts          # Worker entry point
│       └── processors.ts     # Face detection/grouping workers
│
├── .ebextensions/
│   ├── 01_env.config         # API configuration
│   └── 02_worker.config      # Worker configuration
│
├── Procfile                  # API process definition
├── Procfile.worker           # Worker process definition
├── Dockerfile                # API Docker config
├── Dockerfile.worker         # Worker Docker config
├── deploy.sh                 # Deployment script
└── DEPLOYMENT.md             # Full deployment guide
```

---

## Troubleshooting

### Workers not processing jobs

1. Check worker logs:
   ```bash
   eb logs face-media-workers --stream
   ```

2. Verify Redis connection:
   - Ensure REDIS_URL is correct
   - Check Redis is accessible from AWS

3. Restart workers:
   ```bash
   eb deploy face-media-workers
   ```

### API deployment failed

1. Check build succeeded:
   ```bash
   npm run build
   ls dist/  # Should see index.js
   ```

2. Check logs:
   ```bash
   eb logs face-media-api
   ```

### Face detection not working

1. Verify AWS Rekognition permissions:
   - IndexFaces
   - SearchFaces
   - DetectFaces
   - CreateCollection

2. Check worker logs for errors

3. Verify S3 bucket is accessible

---

## Cost Estimate

**Development:**
- API: t3.micro = ~$7/month
- Workers: t3.small = ~$15/month
- **Total: ~$22/month**

**Production (moderate usage):**
- API: t3.small (2 instances) = ~$30/month
- Workers: t3.medium (2 instances) = ~$60/month
- **Total: ~$90/month**

Plus:
- MongoDB Atlas: Free tier or $9/month
- Redis (Upstash): Free tier or $10/month
- S3 Storage: ~$1/month per 40GB
- Rekognition: $1 per 1000 face detections

---

## Next Steps

1. ✅ Test locally (both API and workers)
2. ✅ Deploy to AWS EB
3. 🔲 Set up CloudWatch monitoring
4. 🔲 Configure auto-scaling policies
5. 🔲 Set up custom domain
6. 🔲 Enable HTTPS/SSL
7. 🔲 Set up CI/CD with GitHub Actions

---

## Support

- Full deployment guide: `backend/DEPLOYMENT.md`
- Worker code: `backend/src/workers/`
- Questions? Check AWS EB docs or CloudWatch logs

Happy deploying! 🚀
