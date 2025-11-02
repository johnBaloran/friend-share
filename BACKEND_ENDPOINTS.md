# Backend API Endpoints

All endpoints are now implemented in the Express backend running on `http://localhost:3001/api`

## ✅ Implemented Endpoints

### Groups

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/groups` | Create a new group | ✅ |
| POST | `/groups/join` | Join group with invite code | ✅ |
| GET | `/groups` | List user's groups (paginated) | ✅ |
| GET | `/groups/:id` | Get group by ID | ✅ |
| GET | `/groups/:id/storage` | Get storage analytics | ✅ |
| GET | `/groups/:id/members` | Get group members | ✅ |
| PATCH | `/groups/:groupId/members/:memberId` | Update member role/permissions | ✅ |
| DELETE | `/groups/:groupId/members/:memberId` | Remove member from group | ✅ |

### Media

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/groups/:groupId/upload` | Upload media files to group | ✅ |
| GET | `/groups/:groupId/media` | List media for group (paginated) | ✅ |
| GET | `/media/:id` | Get media by ID with presigned URL | ✅ |
| GET | `/media/:id/download` | Get download URL for media | ✅ |
| DELETE | `/media/:id` | Delete media | ✅ |

### Clusters

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/groups/:groupId/clusters` | List face clusters with sample photos | ✅ |
| GET | `/clusters/:clusterId/media` | Get media for specific cluster (paginated) | ✅ |
| PATCH | `/clusters/:clusterId` | Update cluster name | ✅ |
| DELETE | `/clusters/:clusterId` | Delete cluster | ✅ |

### Jobs

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/jobs/:jobId` | Get job status by ID | ✅ |
| DELETE | `/jobs/:jobId` | Cancel a job | ✅ |
| GET | `/groups/:groupId/jobs` | List jobs for group | ✅ |

## Frontend API Clients

All frontend API clients are available in the `lib/api/` directory:

- **`lib/api/groups.ts`** - Groups API client
- **`lib/api/media.ts`** - Media API client
- **`lib/api/clusters.ts`** - Clusters API client
- **`lib/api/jobs.ts`** - Jobs API client

### Example Usage

```typescript
import { groupsApi } from '@/lib/api/groups';
import { mediaApi } from '@/lib/api/media';
import { clustersApi } from '@/lib/api/clusters';
import { jobsApi } from '@/lib/api/jobs';

// Create a group
const group = await groupsApi.create({ name: 'Family Photos' });

// Upload media
const result = await mediaApi.upload(groupId, files);

// Get clusters
const clusters = await clustersApi.listByGroup(groupId);

// Check job status
const jobStatus = await jobsApi.getStatus(jobId);
```

## Architecture

### Clean Architecture Structure

```
backend/
├── src/
│   ├── core/                      # Business logic
│   │   ├── entities/              # Domain models
│   │   ├── interfaces/
│   │   │   ├── repositories/     # Repository contracts
│   │   │   └── services/         # Service contracts
│   │   └── use-cases/            # Application logic
│   ├── infrastructure/            # External dependencies
│   │   ├── database/
│   │   │   └── mongoose/         # MongoDB implementation
│   │   ├── aws/                  # S3, Rekognition, Face Enhancement
│   │   ├── queue/                # BullMQ job queues
│   │   └── external/             # Clerk authentication
│   ├── presentation/             # HTTP layer
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/               # Route definitions
│   │   └── middleware/           # Express middleware
│   ├── di/                       # Dependency injection
│   └── config/                   # Configuration
```

### Key Features

- **SOLID Principles** - Single Responsibility, Dependency Inversion
- **Clean Architecture** - Core → Infrastructure, Core → Presentation
- **TypeScript** - Full type safety with strict mode
- **ES6 Modules** - Modern JavaScript modules
- **Repository Pattern** - Abstraction over data access
- **Use Case Pattern** - Business logic isolation
- **Dependency Injection** - Manual DI container

## Testing

Test backend connection at: **http://localhost:3000/test-backend**

The test page shows:
- ✅ Backend connection status
- 📊 Groups data
- 🔗 Connection info
- ⚡ Quick actions

## Migration Status

### ✅ Completed (Core Endpoints)
- Groups (CRUD, storage, members)
- Media (upload, download, list, delete)
- Clusters (list, media, update, delete)
- Jobs (status, cancel, list)

### ⏳ Not Migrated (Optional/Complex)
These endpoints are less critical or very complex:
- `/groups/:id/activities` - Activity log
- `/groups/:id/notifications` - Notifications
- `/groups/:id/cleanup` - Cleanup old media
- `/groups/:id/download` - Download all group media
- `/groups/:id/recluster` - Recluster faces

These can be added later if needed.

## Next Steps

1. ✅ All core endpoints implemented
2. ✅ All frontend API clients created
3. ⏳ Test all endpoints via test page
4. ⏳ Delete old Next.js API routes
5. ⏳ Update existing frontend components to use new API

## Notes

- Backend runs on port **3001**
- Frontend runs on port **3000**
- All endpoints require Clerk authentication
- Automatic presigned URLs for S3 media
- Face detection jobs queued automatically on upload
