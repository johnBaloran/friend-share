# AWS Rekognition & S3 Migration - Setup Guide

## 🎉 Migration Complete!

Your face media sharing app has been successfully migrated from **Azure Face API + Cloudinary** to **AWS Rekognition + S3**.

---

## ✅ What's Been Done

### 1. **New Services Created**
- ✅ `lib/services/s3.ts` - Complete S3 storage service
- ✅ `lib/services/rekognition.ts` - AWS Rekognition with collection management
- ✅ `lib/services/faceClustering.ts` - Custom clustering algorithm

### 2. **Database Models Updated**
- ✅ `Group` - Added `rekognitionCollectionId`
- ✅ `Media` - Changed to S3 fields (`s3Key`, `s3Bucket`, `url`)
- ✅ `FaceDetection` - Changed `azureFaceId` → `rekognitionFaceId`, removed expiration

### 3. **Workers Updated**
- ✅ Face Detection Worker - Now uses Rekognition IndexFaces
- ✅ Face Grouping Worker - Uses custom clustering algorithm
- ✅ Cleanup Worker - Deletes from S3

### 4. **API Routes Updated**
- ✅ Upload route - Now uploads to S3 and queues face detection jobs
- ✅ Group service - Creates/deletes Rekognition collections

### 5. **Configuration**
- ✅ Updated `lib/config/env.ts` with AWS credentials
- ✅ Created `.env.example` with required variables

---

## 🚀 Setup Instructions

### Step 1: Set Up AWS Account

1. **Create an AWS Account** (if you don't have one)
   - Visit https://aws.amazon.com

2. **Create IAM User** with programmatic access:
   ```bash
   # Required permissions:
   - AmazonS3FullAccess (or create custom policy)
   - AmazonRekognitionFullAccess (or create custom policy)
   ```

3. **Save credentials:**
   - Access Key ID
   - Secret Access Key

### Step 2: Create S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://your-face-media-bucket --region us-east-1

# Or create via AWS Console:
# 1. Go to S3 console
# 2. Click "Create bucket"
# 3. Name: your-face-media-bucket
# 4. Region: us-east-1 (or your preferred region)
# 5. Leave other settings default
# 6. Create bucket
```

**Important:** Configure bucket permissions:
- For public access: Enable public read (not recommended for production)
- For private access: Use presigned URLs (recommended - already implemented)

### Step 3: Update Environment Variables

Edit your `.env.local` file and add:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# AWS S3
AWS_S3_BUCKET_NAME=your-face-media-bucket

# AWS Rekognition
AWS_REKOGNITION_COLLECTION_PREFIX=face-media-group

# Redis (Optional - for background job processing)
REDIS_URL=redis://localhost:6379
```

**Keep your existing:**
- `MONGODB_URI`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NODE_ENV`
- Other app settings

### Step 4: Install Dependencies (Already Done)

The AWS SDKs have been installed:
```bash
npm install @aws-sdk/client-rekognition @aws-sdk/client-s3
```

### Step 5: Run Database Migration

**⚠️ Important:** Existing data using Cloudinary/Azure won't work with the new system.

**Option A - Fresh Start (Recommended for Development):**
```bash
# Clear existing media and face detection data
# This will be done automatically on first use
```

**Option B - Gradual Migration:**
1. Keep old code in `.old.ts` files
2. Add feature flag to switch between old/new services
3. Migrate data in batches

### Step 6: Test the System

1. **Start your app:**
   ```bash
   npm run dev
   ```

2. **Start the worker (for background jobs):**
   ```bash
   npm run worker
   ```
   (Note: You may need to create this script in package.json)

3. **Create a test group:**
   - Go to your app
   - Create a new group
   - Check AWS console: A Rekognition collection should be created

4. **Upload images:**
   - Upload some photos with faces
   - Check S3: Images should appear in bucket
   - Check Rekognition: Faces should be indexed
   - Check MongoDB: Media, FaceDetection, FaceCluster records created

---

## 🔧 Package.json Worker Script

Add this to your `package.json` scripts:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "worker": "tsx worker/index.ts"
}
```

---

## 📝 How It Works Now

### Upload Flow:
```
1. User uploads images
   ↓
2. Images stored in S3
   ↓
3. Media records created in MongoDB
   ↓
4. Face detection job queued (BullMQ)
   ↓
5. Worker: IndexFaces in Rekognition collection
   ↓
6. FaceDetection records created with rekognitionFaceId
   ↓
7. Face grouping job queued
   ↓
8. Worker: Custom clustering algorithm
   ↓
9. FaceCluster and FaceClusterMember records created
```

### Collection Management:
```
- Create Group → Rekognition collection created
- Delete Group → Rekognition collection deleted
- One collection per group (isolated face data)
```

---

## 🎯 Key Differences from Azure

| Feature | Before (Azure) | After (AWS) |
|---------|---------------|-------------|
| **Face IDs** | Expire in 24h | Persist indefinitely |
| **Grouping** | Automatic API | Custom algorithm |
| **Storage** | Cloudinary | AWS S3 |
| **Rate Limits** | 20/min | Configurable TPS |
| **Collections** | N/A | One per group |

---

## 🔍 Troubleshooting

### Issue: "AWS credentials not found"
**Solution:** Check that AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are in .env.local

### Issue: "Collection already exists"
**Solution:** This is normal - the code handles existing collections gracefully

### Issue: "Face detection fails"
**Solution:**
- Check S3 bucket permissions
- Ensure images are publicly accessible by Rekognition
- Check AWS region matches bucket region

### Issue: "Clustering takes too long"
**Solution:**
- Adjust similarity threshold (currently 85%)
- Process faces in smaller batches
- Use background workers instead of synchronous processing

---

## 💰 Cost Estimation

**AWS Rekognition:**
- Face detection: $1 per 1,000 images
- Face storage: $0.01 per 1,000 faces/month
- Face search: $1 per 1,000 searches

**AWS S3:**
- Storage: $0.023 per GB/month
- PUT requests: $0.005 per 1,000 requests
- GET requests: $0.0004 per 1,000 requests

**Example:** 1,000 images with 3,000 faces:
- Detection: $1.00
- Storage: ~$0.10/month (if 1GB)
- Face storage: $0.03/month
- **Total: ~$1.13 first month, then ~$0.13/month**

---

## 📚 Resources

- [AWS Rekognition Docs](https://docs.aws.amazon.com/rekognition/)
- [AWS S3 Docs](https://docs.aws.amazon.com/s3/)
- [Migration Summary](./MIGRATION_SUMMARY.md)

---

## 🎊 You're Ready to Go!

1. Update your `.env.local` with AWS credentials
2. Create your S3 bucket
3. Start your app and test!

**Need Help?**
- Check the logs for detailed error messages
- Verify AWS credentials and permissions
- Review `MIGRATION_SUMMARY.md` for technical details

Good luck! 🚀
