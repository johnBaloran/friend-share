# Redis Quick Start Guide

## ✅ Redis is Now Enabled!

Redis has been configured and is ready to use for background job processing.

---

## 🚀 How to Run Your App

You need to run **TWO processes** simultaneously:

### Terminal 1: Start the Next.js App
```bash
npm run dev
```
This starts your web application on `http://localhost:3000`

### Terminal 2: Start the Worker
```bash
npm run worker
```
This starts the background job processor that handles:
- Face detection (indexing faces in AWS Rekognition)
- Face clustering (grouping similar faces)
- Cleanup tasks (deleting old media from S3)

---

## 📋 What Happens When You Upload Images

### 1. User Uploads Images
```
POST /api/groups/{groupId}/upload
↓
Images uploaded to S3
↓
Media records created in MongoDB
↓
Response returned to user immediately ✅
```

### 2. Background Job Processing (Happens Automatically)

**Terminal 2 (Worker) will show:**
```
Starting face detection job abc123 for 5 media items
↓
Indexing faces for media 1/5
Indexed 3 faces for media xyz
↓
Indexing faces for media 2/5
...
↓
Face detection job abc123 completed. Detected 12 faces.
↓
Starting face grouping job def456 for 12 face detections
↓
Clustering faces with 85% similarity threshold
↓
Clustering complete: 4 clusters, 2 unclustered faces
↓
Face grouping job def456 completed. Created 4 clusters for 10 faces.
```

---

## 🔍 How to Monitor Jobs

### Check Queue Status
The worker logs will show:
- ✅ Jobs being processed
- ✅ Progress updates
- ✅ Completion status
- ❌ Any errors

### Check Database
Query MongoDB for job status:
```javascript
// Find all jobs for a group
db.job_status.find({ groupId: "your-group-id" })

// Check specific job
db.job_status.findOne({ jobId: "abc123" })
```

### API Endpoint (if implemented)
```
GET /api/jobs/{jobId}
GET /api/groups/{groupId}/jobs
```

---

## 📊 Redis Connection Info

**Using:** Upstash Redis (managed service)
**URL:** `rediss://default:...@comic-sculpin-13690.upstash.io:6379`
**Region:** Auto-configured
**SSL/TLS:** ✅ Enabled (rediss://)

---

## 🛠️ Troubleshooting

### Worker Won't Start
**Error:** `Invalid REDIS_URL format`
**Solution:** Check that REDIS_URL is uncommented in `.env.local`

### Jobs Not Processing
1. **Check if worker is running:**
   ```bash
   # You should see this in Terminal 2:
   Starting Face Media Sharing Worker...
   Face detection worker started
   Face grouping worker started
   Cleanup worker started
   Worker is now processing jobs...
   ```

2. **Check Redis connection:**
   - Worker should connect to Redis on startup
   - If connection fails, check your Upstash Redis dashboard

3. **Check job queue:**
   - Look for queued jobs in worker logs
   - Check MongoDB `job_status` collection

### Slow Processing
**Expected times:**
- Face detection: ~1 second per image
- Face clustering: 5-30 seconds (depending on number of faces)
- 10 images with 30 faces: ~1-2 minutes total

**This is normal!** AWS Rekognition has rate limits.

---

## 💡 Development Tips

### Option 1: Two Terminals (Recommended)
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run worker
```

### Option 2: Use Process Manager
Install `concurrently`:
```bash
npm install -D concurrently
```

Add to `package.json`:
```json
"scripts": {
  "dev:all": "concurrently \"npm run dev\" \"npm run worker\""
}
```

Then run:
```bash
npm run dev:all
```

---

## 🎯 Production Deployment

### Separate Services
In production, run worker as a separate service:

**Web App (Vercel/any host):**
```bash
npm run build
npm run start
```

**Worker (background service):**
```bash
npm run worker
```

### Docker Example
```dockerfile
# Worker Service
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "run", "worker"]
```

### Environment Variables
Both services need:
- ✅ `REDIS_URL` (same for both)
- ✅ `MONGODB_URI` (same for both)
- ✅ `AWS_ACCESS_KEY_ID` (worker needs this)
- ✅ `AWS_SECRET_ACCESS_KEY` (worker needs this)

---

## 📈 Monitoring in Production

### Queue Stats
Monitor your queues:
```typescript
import { QueueManager } from "@/lib/queues/manager";

const stats = await QueueManager.getQueueStats();
console.log(stats);
// {
//   faceDetection: { waiting: 5, active: 2, completed: 100, failed: 1 },
//   faceGrouping: { waiting: 2, active: 1, completed: 50, failed: 0 },
//   cleanup: { waiting: 0, active: 0, completed: 10, failed: 0 }
// }
```

### Upstash Dashboard
Check your Redis usage:
- https://console.upstash.com
- Monitor commands/sec
- Monitor memory usage
- Free tier: 10,000 commands/day

---

## 🎊 You're All Set!

**To test:**
1. Start both processes (app + worker)
2. Upload some images with faces
3. Watch the worker logs process the jobs
4. Check your database for face clusters
5. View grouped photos in the UI

**Happy coding! 🚀**
