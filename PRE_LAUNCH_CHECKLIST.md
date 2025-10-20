# Pre-Launch Checklist

Before launching your AWS Rekognition + S3 powered app, complete this checklist:

## ✅ AWS Setup

- [ ] Created AWS account
- [ ] Created IAM user with programmatic access
- [ ] Saved Access Key ID and Secret Access Key
- [ ] Created S3 bucket (e.g., `your-face-media-bucket`)
- [ ] Configured bucket region (matches `AWS_REGION` in .env)
- [ ] Tested AWS credentials with AWS CLI or console

## ✅ Environment Variables

- [ ] Updated `.env.local` with `AWS_ACCESS_KEY_ID`
- [ ] Updated `.env.local` with `AWS_SECRET_ACCESS_KEY`
- [ ] Updated `.env.local` with `AWS_REGION`
- [ ] Updated `.env.local` with `AWS_S3_BUCKET_NAME`
- [ ] Optional: Updated `REDIS_URL` for background jobs
- [ ] Verified all existing variables still work (MongoDB, Clerk, etc.)

## ✅ Code Verification

- [ ] Reviewed `lib/services/s3.ts` - S3 upload/delete operations
- [ ] Reviewed `lib/services/rekognition.ts` - Face detection and search
- [ ] Reviewed `lib/services/faceClustering.ts` - Clustering algorithm
- [ ] Reviewed `lib/queues/workers.ts` - Updated workers
- [ ] Reviewed `lib/services/groupService.ts` - Collection lifecycle
- [ ] Reviewed upload route - Now uses S3

## ✅ Dependencies

- [ ] Verified `@aws-sdk/client-rekognition` installed
- [ ] Verified `@aws-sdk/client-s3` installed
- [ ] Run `npm install` to ensure all dependencies are up to date
- [ ] No TypeScript errors: `npm run lint`

## ✅ Database

- [ ] MongoDB connection working
- [ ] Models updated (Group, Media, FaceDetection)
- [ ] Understand that old data (Cloudinary/Azure) won't work
- [ ] Plan to either:
  - [ ] Start fresh (recommended for dev)
  - [ ] Implement data migration (for production)

## ✅ Testing Plan

### 1. Group Creation
- [ ] Create a new group
- [ ] Verify Rekognition collection created (check AWS console or logs)
- [ ] Collection ID stored in `rekognitionCollectionId` field

### 2. Image Upload
- [ ] Upload test images (3-5 photos with faces)
- [ ] Images appear in S3 bucket
- [ ] Media records created in MongoDB
- [ ] Check console logs for face detection job queued

### 3. Face Detection (Background Worker)
- [ ] Start worker: `npm run worker`
- [ ] Worker processes face detection jobs
- [ ] Faces indexed in Rekognition collection
- [ ] FaceDetection records created with `rekognitionFaceId`

### 4. Face Clustering
- [ ] Face grouping job triggered after detection
- [ ] Clustering algorithm runs
- [ ] FaceCluster records created
- [ ] FaceClusterMember records link faces to clusters
- [ ] View clusters in UI

### 5. Download/Delete
- [ ] Download images from S3 (via presigned URLs)
- [ ] Delete images removes from S3
- [ ] Verify storage usage updated

### 6. Group Deletion
- [ ] Delete a test group
- [ ] Rekognition collection deleted
- [ ] All media deleted from S3
- [ ] Database records cleaned up

## ✅ Performance & Costs

- [ ] Understand face detection takes ~1 second per image
- [ ] Understand clustering can take 5-30 seconds for large batches
- [ ] Set up AWS billing alerts:
  - [ ] Alert at $10/month
  - [ ] Alert at $50/month
- [ ] Monitor AWS usage for first week

## ✅ Error Handling

- [ ] Test what happens if AWS credentials are invalid
- [ ] Test what happens if S3 bucket doesn't exist
- [ ] Test what happens if Rekognition fails
- [ ] Test what happens if clustering fails
- [ ] Verify graceful degradation (files uploaded even if face detection fails)

## ✅ Production Readiness

- [ ] Set up proper S3 bucket policies (private + presigned URLs)
- [ ] Enable S3 versioning (optional, for backup)
- [ ] Set up CloudWatch alarms for errors
- [ ] Configure proper CORS for S3 bucket
- [ ] Review and adjust similarity threshold (currently 85%)
- [ ] Consider implementing rate limiting for uploads
- [ ] Set up proper error tracking (Sentry, etc.)

## ✅ Documentation

- [ ] Read `SETUP_GUIDE.md`
- [ ] Read `MIGRATION_SUMMARY.md`
- [ ] Understand the new workflow (S3 + Rekognition)
- [ ] Team members trained on new system

## ✅ Backup Plan

- [ ] Old code backed up in `.old.ts` files
- [ ] Can rollback to Cloudinary/Azure if needed
- [ ] Database schema changes are backward compatible (new fields optional)

---

## 🚦 Launch Decision

**I am ready to launch when:**
- [ ] All AWS Setup items completed
- [ ] All Environment Variables configured
- [ ] At least one successful end-to-end test completed
- [ ] Error handling tested
- [ ] Team is aware of the changes

**Post-Launch Monitoring (First 24 Hours):**
- [ ] Monitor AWS costs in billing dashboard
- [ ] Monitor application logs for errors
- [ ] Monitor face detection success rate
- [ ] Monitor clustering accuracy
- [ ] Check user feedback

---

## 📞 Support

If you encounter issues:
1. Check application logs
2. Check AWS CloudWatch logs
3. Verify credentials and permissions
4. Review `MIGRATION_SUMMARY.md` for technical details
5. Test with smaller batch sizes

---

**Ready? Let's go! 🚀**
