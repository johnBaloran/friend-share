# AWS Rekognition & S3 Migration Summary

## ✅ Completed Tasks

### 1. **Installed Packages**
- `@aws-sdk/client-rekognition`
- `@aws-sdk/client-s3`

### 2. **Updated Environment Configuration**
Added to `lib/config/env.ts`:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET_NAME`
- `AWS_REKOGNITION_COLLECTION_PREFIX`

**`.env.example` created** - You need to update your `.env.local` with AWS credentials!

### 3. **Created New Services**

#### `lib/services/s3.ts`
Replaces Cloudinary with S3 storage. Key methods:
- `uploadMedia()` - Upload files to S3
- `deleteMedia()` - Delete single file
- `bulkDelete()` - Delete multiple files
- `getPresignedUrl()` - Generate temporary access URLs
- `getObjectBuffer()` - Get file as buffer for Rekognition

#### `lib/services/rekognition.ts`
AWS Rekognition client with collection management:
- `createCollection()` - Create collection for a group
- `deleteCollection()` - Delete collection
- `detectFaces()` - Detect faces in S3 image
- `indexFaces()` - Index faces into collection
- `searchFacesByImage()` - Find similar faces
- `searchFaces()` - Search by face ID
- `deleteFaces()` - Remove faces from collection

#### `lib/services/faceClustering.ts`
**Custom clustering algorithm** (replaces Azure's automatic grouping):
- Uses similarity search to build face graph
- Implements Union-Find algorithm for connected components
- Clusters faces with 85%+ similarity as same person
- Supports incremental clustering for new faces

### 4. **Updated Database Models**

#### `Group` model (`lib/models/Group.ts`):
- Added `rekognitionCollectionId?: string`

#### `Media` model (`lib/models/Media.ts`):
- Replaced `cloudinaryUrl` with `s3Key`, `s3Bucket`, `url`
- Removed `publicId` (used S3 key instead)

#### `FaceDetection` model (`lib/models/FaceDetection.ts`):
- Renamed `azureFaceId` → `rekognitionFaceId`
- **Removed `expiresAt`** (Rekognition IDs don't expire!)

### 5. **Updated Types** (`lib/types/index.ts`)
- Updated all interfaces to match model changes
- Added `RekognitionFaceDetection`, `RekognitionSearchResult`
- Added `S3UploadResult`
- Removed Azure-specific types

---

## 🚧 Remaining Tasks

### 1. **Update Workers** (`lib/queues/workers.ts`)
The workers need significant changes:

**Face Detection Worker:**
```typescript
// OLD: Azure workflow
1. Get media URLs from DB
2. Call azureFaceService.detectFaces(urls)
3. Store face detections with azureFaceId
4. Queue grouping job

// NEW: AWS Rekognition workflow
1. Get media S3 keys from DB
2. Index faces directly into collection (detectFaces + indexFaces combined)
3. Store face detections with rekognitionFaceId
4. Queue grouping job
```

**Face Grouping Worker:**
```typescript
// OLD: Azure workflow
1. Get face detections (check not expired)
2. Call azureFaceService.groupFaces() - automatic grouping
3. Create clusters from groups
4. Handle messyGroup

// NEW: AWS Rekognition workflow
1. Get face detections (no expiration check)
2. Call FaceClusteringService.clusterFaces() - custom algorithm
3. For each cluster, create FaceCluster in DB
4. Link faces to clusters via FaceClusterMember
```

**Cleanup Worker:**
```typescript
// OLD: Cloudinary
- CloudinaryService.bulkDelete(publicIds)

// NEW: S3
- S3Service.bulkDelete(s3Keys)
```

### 2. **Update API Routes**
Update media upload route (`app/api/groups/[groupId]/upload/route.ts`):
- Replace CloudinaryService with S3Service
- Store s3Key, s3Bucket, url instead of cloudinaryUrl, publicId

### 3. **Collection Lifecycle Management**
Add hooks to group management:
- **On group creation**: Call `RekognitionService.createCollection(groupId)`
- **On group deletion**: Call `RekognitionService.deleteCollection(collectionId)`

---

## 🔑 Key Differences: Azure vs AWS

| Aspect | Azure Face API | AWS Rekognition |
|--------|---------------|----------------|
| **Face IDs** | Expire in 24h | Persist in collections |
| **Grouping** | Automatic Group API | Manual clustering required |
| **Storage** | Works with any URL | Requires S3 (preferred) |
| **Collections** | N/A | One per group |
| **Workflow** | Detect → Group | Detect → Index → Search → Cluster |

---

## ⚙️ Setup Instructions

### 1. **Create AWS Resources**

```bash
# 1. Create S3 Bucket
aws s3 mb s3://your-face-media-bucket

# 2. Configure bucket permissions (public read for media URLs)
# Or use presigned URLs for better security

# 3. Create IAM user with permissions:
# - AmazonS3FullAccess (or custom S3 policy)
# - AmazonRekognitionFullAccess (or custom Rekognition policy)
```

### 2. **Update .env.local**

Add to your `.env.local`:
```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# AWS S3
AWS_S3_BUCKET_NAME=your-face-media-bucket

# AWS Rekognition
AWS_REKOGNITION_COLLECTION_PREFIX=face-media-group
```

### 3. **Migration Strategy**

**Option A: Fresh Start** (Recommended for development)
- Drop existing media and face detection data
- Start using AWS services for all new uploads

**Option B: Gradual Migration**
- Keep Cloudinary/Azure code alongside AWS code
- Add feature flag to switch between services
- Migrate data in batches

---

## 📝 Next Steps

1. **Update workers** to use new services
2. **Update upload API route** to use S3
3. **Add collection management** to group routes
4. **Test the full pipeline**:
   - Create group → Collection created
   - Upload images → Stored in S3
   - Face detection → Indexed in Rekognition
   - Face clustering → Custom algorithm works
   - Download/Delete → S3 operations work
   - Delete group → Collection deleted

---

## ⚠️ Important Notes

1. **Face IDs don't expire** - No rush to process grouping!
2. **Collection per group** - Each group has isolated face data
3. **Custom clustering** - Adjust similarity threshold (85%) as needed
4. **S3 costs** - Monitor storage and data transfer
5. **Rekognition costs** - $1 per 1000 face detections + storage

---

## 🐛 Potential Issues

1. **Rate Limiting**: Rekognition has TPS limits (check AWS quotas)
2. **Cold Start**: First detection in collection might be slower
3. **Clustering Performance**: Large batches (>1000 faces) take time
4. **S3 URLs**: Public vs presigned URLs for media access
5. **Collection Limits**: Max 20M faces per collection

---

## 📚 Resources

- [AWS Rekognition Documentation](https://docs.aws.amazon.com/rekognition/)
- [S3 SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html)
- [Rekognition Pricing](https://aws.amazon.com/rekognition/pricing/)
