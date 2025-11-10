# 🚀 Quick Deployment Guide

## Step 1: Deploy Backend to Railway (5 minutes)

### 1.1 Push to GitHub
```bash
cd backend
git add .
git commit -m "Prepare backend for Railway deployment"
git push origin main
```

### 1.2 Create Railway Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select the `/backend` folder as root directory

### 1.3 Add Environment Variables
In Railway dashboard, go to **Variables** and add:

```env
NODE_ENV=production
MONGODB_URI=<your-mongodb-atlas-url>
REDIS_URL=<your-upstash-redis-url>
CLERK_PUBLISHABLE_KEY=<from-clerk-dashboard>
CLERK_SECRET_KEY=<from-clerk-dashboard>
CLERK_WEBHOOK_SECRET=<from-clerk-dashboard>
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=us-east-2
AWS_S3_BUCKET_NAME=<your-s3-bucket>
AWS_REKOGNITION_COLLECTION_PREFIX=face-media-group
CORS_ORIGIN=<your-vercel-frontend-url>
MAX_FILE_SIZE=10485760
MAX_FILES_PER_UPLOAD=50
ENABLE_RATE_LIMITING=true
```

### 1.4 Deploy!
Railway will automatically:
- Install dependencies
- Build TypeScript
- Start both API server and worker

**Wait for:** "✅ API Server and Worker started successfully"

### 1.5 Get Your API URL
Copy the Railway URL (e.g., `https://your-app.up.railway.app`)

---

## Step 2: Deploy Frontend to Vercel (3 minutes)

### 2.1 Push to GitHub
```bash
cd .. # back to root
git add .
git commit -m "Prepare frontend for Vercel deployment"
git push origin main
```

### 2.2 Create Vercel Project
1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. **Root Directory:** Leave as `.` (root)
5. **Framework Preset:** Next.js

### 2.3 Add Environment Variables
In Vercel project settings → Environment Variables:

```env
NEXT_PUBLIC_API_URL=<your-railway-url>/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<from-clerk-dashboard>
CLERK_SECRET_KEY=<from-clerk-dashboard>
```

### 2.4 Deploy!
Click "Deploy"

Vercel will:
- Install dependencies
- Build Next.js
- Deploy to production

---

## Step 3: Update CORS in Railway (1 minute)

1. Go back to Railway project
2. Update the `CORS_ORIGIN` variable with your Vercel URL:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```
3. Railway will auto-redeploy

---

## Step 4: Test Your Deployment 🎉

1. Visit your Vercel URL
2. Sign up / Sign in with Clerk
3. Create a group
4. Upload photos with faces
5. Wait for face detection (check Railway logs)
6. View people detected in your photos!

---

## Quick Links

### Railway
- **Dashboard:** https://railway.app/dashboard
- **Logs:** Click your service → Logs tab
- **Metrics:** Click your service → Metrics tab

### Vercel
- **Dashboard:** https://vercel.com/dashboard
- **Logs:** Click your project → Deployments → View logs
- **Domains:** Click your project → Domains

### Services You'll Need

| Service | What For | Link |
|---------|----------|------|
| MongoDB Atlas | Database | https://cloud.mongodb.com |
| Upstash Redis | Job Queue | https://console.upstash.com |
| AWS S3 | File Storage | https://console.aws.amazon.com/s3 |
| AWS Rekognition | Face Detection | https://console.aws.amazon.com/rekognition |
| Clerk | Authentication | https://dashboard.clerk.com |

---

## Troubleshooting

### Backend Not Starting?
**Check Railway Logs:**
- MongoDB connection error? → Check `MONGODB_URI`
- Redis connection error? → Check `REDIS_URL`
- AWS errors? → Check AWS credentials

### Frontend Can't Connect to Backend?
**Check:**
1. Railway backend is running (green status)
2. `NEXT_PUBLIC_API_URL` is correct in Vercel
3. `CORS_ORIGIN` includes your Vercel URL

### Worker Not Processing Jobs?
**Check Railway Logs for:**
- `[Worker] Connected to Redis` ✅
- `[Worker] Face detection worker started` ✅
- `[Worker] Face grouping worker started` ✅

If missing, check `REDIS_URL` is correct

---

## Costs Estimate (Monthly)

| Service | Free Tier | Paid Plan |
|---------|-----------|-----------|
| Railway | $5 credit | ~$5-20/month |
| Vercel | Hobby (free) | Pro $20/month |
| MongoDB Atlas | 512MB free | M10 $9/month |
| Upstash Redis | 10K commands/day | $10/month |
| AWS S3 | 5GB free year 1 | ~$1-5/month |
| AWS Rekognition | 1,000 faces/month | ~$1/1000 faces |
| Clerk | 10K MAU free | Pro $25/month |

**Total for small project:** $0-10/month (using free tiers)
**Total for production:** $50-100/month

---

## Next Steps After Deployment

1. ✅ Set up custom domain (Vercel + Railway)
2. ✅ Enable monitoring (Sentry)
3. ✅ Set up backups (MongoDB Atlas)
4. ✅ Configure S3 lifecycle rules
5. ✅ Add more OAuth providers in Clerk
6. ✅ Implement email notifications

---

## Support

- **Railway:** https://discord.gg/railway
- **Vercel:** https://vercel.com/support
- **Next.js:** https://github.com/vercel/next.js/discussions

Good luck! 🚀
