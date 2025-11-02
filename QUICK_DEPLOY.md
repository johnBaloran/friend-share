# ⚡ Quick Deploy to AWS - 15 Minutes

This is a streamlined guide to get your app running on AWS ASAP.

## 🎯 What You'll Deploy

- **Frontend**: AWS Amplify (auto-deploys from Git)
- **Backend**: AWS Elastic Beanstalk
- **Database**: MongoDB Atlas (Free)
- **Redis**: AWS ElastiCache
- **Storage**: AWS S3 (already configured)
- **Face Detection**: AWS Rekognition (already configured)

---

## ⏱️ Step 1: Database (3 minutes)

### MongoDB Atlas - Free Tier

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up → Create Free Cluster
3. Choose **AWS**, **us-east-1**, **M0 Free**
4. Create cluster
5. **Database Access** → Add user: `admin` / create password
6. **Network Access** → Allow access from anywhere (0.0.0.0/0)
7. **Connect** → Get connection string:
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/face-media
   ```
8. **Save this connection string!**

---

## ⏱️ Step 2: Redis (2 minutes)

```bash
# Create ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id face-media-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --region us-east-1

# Get endpoint (wait 2-3 minutes for creation)
aws elasticache describe-cache-clusters \
  --cache-cluster-id face-media-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text
```

**Save the Redis endpoint!**

---

## ⏱️ Step 3: S3 Bucket (1 minute)

```bash
# Create bucket
aws s3 mb s3://face-media-storage-$(date +%s) --region us-east-1

# Note your bucket name!
BUCKET_NAME="face-media-storage-XXXXX"

# Set CORS
aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"]
  }]
}'
```

---

## ⏱️ Step 4: Deploy Backend (5 minutes)

```bash
cd backend

# Install EB CLI if needed
pip install awsebcli

# Initialize
eb init -p node.js-18 face-media-backend --region us-east-1

# Create environment
eb create face-media-prod --instance-type t3.small

# Set environment variables (USE YOUR VALUES!)
eb setenv \
  NODE_ENV=production \
  PORT=8080 \
  MONGODB_URI="YOUR_MONGODB_CONNECTION_STRING" \
  REDIS_HOST="YOUR_REDIS_ENDPOINT" \
  REDIS_PORT=6379 \
  AWS_REGION=us-east-1 \
  AWS_ACCESS_KEY_ID="YOUR_AWS_KEY" \
  AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET" \
  S3_BUCKET="YOUR_BUCKET_NAME" \
  REKOGNITION_COLLECTION_PREFIX="face-media" \
  CLERK_PUBLISHABLE_KEY="YOUR_CLERK_PK" \
  CLERK_SECRET_KEY="YOUR_CLERK_SK" \
  CORS_ORIGIN="*" \
  API_PREFIX="/api"

# Build and deploy
npm run build
eb deploy

# Get your backend URL
eb status | grep "CNAME"
```

**Save your backend URL!** (e.g., `face-media-prod.us-east-1.elasticbeanstalk.com`)

---

## ⏱️ Step 5: Deploy Frontend (4 minutes)

### Option A: AWS Amplify (Easiest - Auto Deploy)

1. Push code to GitHub:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. Go to **AWS Amplify Console**
3. **New app** → **Host web app** → **GitHub**
4. Select your repository
5. Add environment variables:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk key
   - `CLERK_SECRET_KEY`: Your Clerk secret
   - `NEXT_PUBLIC_API_URL`: http://YOUR_BACKEND_URL/api
6. **Save and Deploy**
7. Wait 2-3 minutes

**Your frontend URL**: `https://main.xxxxx.amplifyapp.com`

### Option B: Vercel (Alternative)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts, set environment variables when asked
```

---

## ⏱️ Step 6: Update CORS (1 minute)

```bash
cd backend

# Update CORS to allow your frontend
eb setenv CORS_ORIGIN="https://YOUR_AMPLIFY_URL.amplifyapp.com"
```

---

## ✅ Done!

Your app is live!

**Frontend**: https://main.xxxxx.amplifyapp.com
**Backend**: http://face-media-prod.us-east-1.elasticbeanstalk.com/api

### Test It:
1. Visit your frontend URL
2. Sign up with Clerk
3. Create a group
4. Upload a photo with faces
5. Watch face detection work!

---

## 🔧 Useful Commands

```bash
# Backend logs
eb logs

# Backend status
eb status

# Redeploy backend
cd backend && npm run build && eb deploy

# Redeploy frontend (Amplify)
git push origin main

# Open backend in browser
eb open
```

---

## 💰 Cost

- **MongoDB Atlas M0**: FREE
- **EC2 t3.small**: ~$15/month
- **ElastiCache t3.micro**: ~$12/month
- **S3**: ~$0.023/GB
- **Rekognition**: $1/1000 images
- **Amplify**: $0.01/build minute

**Total**: ~$30/month for light usage

---

## 🆘 Troubleshooting

### Backend won't start
```bash
eb logs
# Check for environment variable errors
```

### Can't connect to MongoDB
- Check whitelist IP in MongoDB Atlas (use 0.0.0.0/0)
- Verify connection string format

### Frontend can't reach backend
- Check CORS settings
- Verify NEXT_PUBLIC_API_URL is correct
- Check backend is running: `curl YOUR_BACKEND_URL/api/health`

### Face detection not working
- Verify AWS credentials
- Check S3 bucket permissions
- Check Rekognition collection exists

---

## 🎉 Success!

Questions? Check the full guide: `AWS_DEPLOYMENT_GUIDE.md`
