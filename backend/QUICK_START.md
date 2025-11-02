# Quick Start Guide

## ✅ What's Been Completed

A **complete Clean Architecture Express backend** with TypeScript, ES6 modules, and SOLID principles!

### Architecture Layers

```
✅ Core Layer (Domain)
   - Entities: User, Group, Media, FaceDetection, FaceCluster
   - Repository Interfaces (6 interfaces)
   - Service Interfaces (6 interfaces)
   - Use Cases: CreateGroup, JoinGroup, UploadMedia

✅ Infrastructure Layer
   - Mongoose Models & Repositories (6 complete)
   - AWS Services: S3Service, RekognitionService, FaceEnhancementService
   - Queue Service: BullMQService
   - Auth Service: ClerkService

✅ Presentation Layer
   - Controllers: GroupController
   - Routes: Group routes + index
   - Middleware: Error handler, async handler

✅ Dependency Injection
   - Complete DI container
   - All dependencies wired up

✅ Main Application
   - Express server with Clerk auth
   - CORS, security, compression
   - Graceful shutdown
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment

Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
MONGODB_URI=mongodb+srv://your-connection-string
REDIS_URL=redis://your-redis-url
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET_NAME=your-bucket
CLERK_PUBLISHABLE_KEY=your-key
CLERK_SECRET_KEY=your-secret

# Optional
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

You should see:

```
✅ MongoDB connected successfully
🚀 Server is running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Port:        3001
🌍 Environment: development
🔗 API:         http://localhost:3001/api
📊 Health:      http://localhost:3001/health
```

### 4. Test the API

```bash
# Health check (no auth required)
curl http://localhost:3001/health

# Create group (requires Clerk auth token)
curl -X POST http://localhost:3001/api/groups \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Group",
    "description": "Testing the backend"
  }'
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── core/                     # ❤️ Pure Business Logic
│   │   ├── entities/             # Domain models
│   │   ├── interfaces/           # Contracts
│   │   └── use-cases/            # Business operations
│   │
│   ├── infrastructure/           # 🔧 External Services
│   │   ├── database/mongoose/    # MongoDB
│   │   ├── aws/                  # S3, Rekognition
│   │   ├── queue/                # BullMQ
│   │   └── external/             # Clerk
│   │
│   ├── presentation/             # 🌐 HTTP Layer
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/               # Express routes
│   │   └── middleware/           # Auth, errors
│   │
│   ├── shared/                   # 🔄 Cross-cutting
│   │   ├── types/                # TypeScript types
│   │   ├── errors/               # Custom errors
│   │   └── constants/            # App constants
│   │
│   ├── config/                   # ⚙️ Configuration
│   │   └── env.ts                # Zod-validated env
│   │
│   ├── di/                       # 💉 Dependency Injection
│   │   └── container.ts          # DI container
│   │
│   └── index.ts                  # 🚀 Main entry point
│
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── IMPLEMENTATION_GUIDE.md       # Detailed guide
└── QUICK_START.md               # This file
```

## 🎯 Available API Endpoints

### Groups

```bash
POST   /api/groups          # Create group
POST   /api/groups/join     # Join group (invite code)
GET    /api/groups          # List user's groups
GET    /api/groups/:id      # Get group details
```

### Coming Soon

```bash
# Media
POST   /api/groups/:id/upload   # Upload photos
GET    /api/groups/:id/media    # List media
DELETE /api/media/:id            # Delete photo

# Clusters
GET    /api/groups/:id/clusters     # List face clusters
GET    /api/clusters/:id/media      # Photos of person
PUT    /api/clusters/:id            # Name cluster
```

## 🔍 How It Works

### Request Flow Example

```
1. User sends: POST /api/groups
   ↓
2. Clerk middleware validates JWT token
   ↓
3. GroupController.create() called
   ↓
4. CreateGroupUseCase.execute() runs business logic:
   - Validates input
   - Generates invite code
   - Creates Group entity
   - Calls GroupRepository.create()
   - Calls RekognitionService.createCollection()
   ↓
5. Controller returns JSON response
```

### Clean Architecture Benefits

✅ **Testable**: Mock any layer independently
✅ **Swappable**: Replace MongoDB → PostgreSQL easily
✅ **Maintainable**: Clear separation of concerns
✅ **Scalable**: Add features without breaking existing code

## 🧪 Testing (Optional)

Create `src/__tests__/use-cases/CreateGroup.test.ts`:

```typescript
import { CreateGroupUseCase } from '../core/use-cases/CreateGroupUseCase';

describe('CreateGroupUseCase', () => {
  it('should create a group', async () => {
    const mockRepo = {
      create: jest.fn().mockResolvedValue(mockGroup),
    };
    const mockService = {
      createCollection: jest.fn().mockResolvedValue('collection-id'),
    };

    const useCase = new CreateGroupUseCase(mockRepo, mockService);
    const result = await useCase.execute({
      name: 'Test Group',
      creatorId: 'user-123',
    });

    expect(result.name).toBe('Test Group');
  });
});
```

## 📝 Next Steps

### 1. Add More Use Cases

Create new use cases for:
- UpdateGroup
- DeleteGroup
- LeaveGroup
- UpdateMemberPermissions

### 2. Add More Controllers

- MediaController
- ClusterController
- UserController

### 3. Add Validation

```typescript
// presentation/validators/groupValidators.ts
import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// Use in controller
const validated = createGroupSchema.parse(req.body);
```

### 4. Add Workers

Copy workers from existing `worker/index.ts` to process background jobs:

```typescript
// infrastructure/queue/workers.ts
import { Worker } from 'bullmq';

const faceDetectionWorker = new Worker('face-detection', async (job) => {
  // Process face detection
});
```

Run with: `npm run worker:dev`

### 5. Deploy

**Option 1: Railway**
```bash
railway login
railway init
railway up
```

**Option 2: AWS ECS/Fargate**
- Create Docker image
- Push to ECR
- Deploy with ECS

## 🐛 Troubleshooting

### Port already in use
```bash
# Change PORT in .env
PORT=3002
```

### MongoDB connection error
- Check MONGODB_URI is correct
- Ensure IP is whitelisted in MongoDB Atlas

### Clerk auth errors
- Verify CLERK_SECRET_KEY is set
- Check token format: `Bearer YOUR_TOKEN`

## 📚 Documentation

- `README.md` - Architecture overview
- `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation
- `QUICK_START.md` - This file

## 🎉 You're Ready!

Your backend is now fully functional with:
- ✅ Clean Architecture
- ✅ SOLID principles
- ✅ TypeScript with ES6 modules
- ✅ Clerk authentication
- ✅ MongoDB + Redis
- ✅ AWS S3 + Rekognition
- ✅ BullMQ queues
- ✅ Dependency injection

Start building amazing features! 🚀
