# Backend Implementation Guide

## Current Progress

### ✅ COMPLETED

#### 1. Project Setup
- ✅ package.json with ES6 modules
- ✅ TypeScript configuration
- ✅ Environment configuration with Zod validation
- ✅ Clean Architecture directory structure

#### 2. Shared Layer (`src/shared/`)
- ✅ Custom error classes (AppError, BadRequestError, etc.)
- ✅ Constants (MemberRole, JobType, DEFAULTS, etc.)
- ✅ TypeScript types

#### 3. Core Layer (`src/core/`)
- ✅ **Entities**: User, Group, Media, FaceDetection, FaceCluster
- ✅ **Repository Interfaces**: All 6 repositories defined
- ✅ **Service Interfaces**: Storage, FaceRecognition, Queue, Auth, FaceEnhancement
- ✅ **Use Cases**: CreateGroup, JoinGroup, UploadMedia

### 🚧 REMAINING WORK

## Step 1: Complete Infrastructure Layer

### A. Mongoose Models (`infrastructure/database/mongoose/models/`)

Create these models (copy from existing Next.js `lib/models/`):

```typescript
// UserModel.ts
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: String,
  avatar: String,
  emailVerified: Date,
}, { timestamps: true });

export const UserModel = mongoose.model('User', userSchema);
```

**Files to create:**
1. ✅ `UserModel.ts`
2. ✅ `GroupModel.ts`
3. ✅ `MediaModel.ts`
4. ✅ `FaceDetectionModel.ts`
5. ✅ `FaceClusterModel.ts`
6. ✅ `FaceClusterMemberModel.ts`

### B. Repository Implementations (`infrastructure/database/mongoose/repositories/`)

These convert between Mongoose documents and domain entities:

```typescript
// UserRepository.ts
import { IUserRepository } from '../../../../core/interfaces/repositories/IUserRepository.js';
import { User } from '../../../../core/entities/User.js';
import { UserModel } from '../models/UserModel.js';

export class MongoUserRepository implements IUserRepository {
  async create(user: User): Promise<User> {
    const doc = await UserModel.create({
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    return this.toEntity(doc);
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    const doc = await UserModel.findOne({ clerkId });
    return doc ? this.toEntity(doc) : null;
  }

  private toEntity(doc: any): User {
    return new User(
      doc._id.toString(),
      doc.clerkId,
      doc.email,
      doc.name,
      doc.avatar,
      doc.emailVerified,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
```

**Files to create:**
1. ✅ `UserRepository.ts`
2. ✅ `GroupRepository.ts`
3. ✅ `MediaRepository.ts`
4. ✅ `FaceDetectionRepository.ts`
5. ✅ `FaceClusterRepository.ts`
6. ✅ `FaceClusterMemberRepository.ts`

### C. AWS Services (`infrastructure/aws/`)

Copy and adapt from existing Next.js `lib/services/`:

```typescript
// S3Service.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from '../../core/interfaces/services/IStorageService.js';
import { env } from '../../config/env.js';

export class S3Service implements IStorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: env.get('AWS_REGION'),
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = env.get('AWS_S3_BUCKET_NAME');
  }

  async uploadFile(buffer: Buffer, filename: string, groupId: string, contentType: string) {
    const key = `groups/${groupId}/${filename}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    return {
      key,
      bucket: this.bucket,
      url: `https://${this.bucket}.s3.${env.get('AWS_REGION')}.amazonaws.com/${key}`,
    };
  }

  // ... implement other methods
}
```

**Files to create:**
1. ✅ `S3Service.ts` - Copy from `lib/services/s3.ts`
2. ✅ `RekognitionService.ts` - Copy from `lib/services/rekognition.ts`
3. ✅ `FaceEnhancementService.ts` - Copy from `lib/services/faceEnhancement.ts`

### D. Queue Service (`infrastructure/queue/`)

```typescript
// BullMQService.ts
import { Queue, QueueOptions } from 'bullmq';
import { IQueueService } from '../../core/interfaces/services/IQueueService.js';
import { env } from '../../config/env.js';

export class BullMQService implements IQueueService {
  private queues: Map<string, Queue> = new Map();

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, new Queue(queueName, {
        connection: { url: env.get('REDIS_URL') },
      }));
    }
    return this.queues.get(queueName)!;
  }

  async addJob(queueName: string, jobType: string, data: any, options?: any) {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobType, data, options);
    return job.id!;
  }

  // ... implement other methods
}
```

**Files to create:**
1. ✅ `BullMQService.ts`
2. ✅ `workers.ts` - Worker implementations

### E. Clerk Auth Service (`infrastructure/external/`)

```typescript
// ClerkService.ts
import { clerkClient } from '@clerk/express';
import { IAuthService, ClerkUser } from '../../core/interfaces/services/IAuthService.js';
import { User } from '../../core/entities/User.js';
import { IUserRepository } from '../../core/interfaces/repositories/IUserRepository.js';

export class ClerkService implements IAuthService {
  constructor(private userRepository: IUserRepository) {}

  async validateToken(token: string): Promise<string> {
    // Clerk handles this via middleware
    // This is more for manual validation if needed
    throw new Error('Use Clerk middleware for token validation');
  }

  async getUserFromClerk(clerkUserId: string): Promise<ClerkUser> {
    const user = await clerkClient.users.getUser(clerkUserId);
    return {
      id: user.id,
      emailAddresses: user.emailAddresses,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    };
  }

  async syncUser(clerkUser: ClerkUser): Promise<User> {
    let user = await this.userRepository.findByClerkId(clerkUser.id);

    if (!user) {
      user = await this.userRepository.create(User.create({
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0].emailAddress,
        name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim(),
        avatar: clerkUser.imageUrl,
      }));
    }

    return user;
  }
}
```

**Files to create:**
1. ✅ `ClerkService.ts`

## Step 2: Complete Presentation Layer

### A. DTOs (`presentation/dto/`)

```typescript
// GroupDto.ts
export interface CreateGroupRequestDto {
  name: string;
  description?: string;
  storageLimit?: number;
  autoDeleteDays?: number;
}

export interface GroupResponseDto {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  memberCount: number;
  storageUsed: number;
  storageLimit: number;
  role: string;
  createdAt: Date;
}
```

**Files to create:**
1. ✅ `GroupDto.ts`
2. ✅ `MediaDto.ts`
3. ✅ `ClusterDto.ts`

### B. Validators (`presentation/validators/`)

```typescript
// groupValidators.ts
import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  storageLimit: z.number().positive().optional(),
  autoDeleteDays: z.number().positive().optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().length(8),
});
```

**Files to create:**
1. ✅ `groupValidators.ts`
2. ✅ `mediaValidators.ts`

### C. Controllers (`presentation/controllers/`)

```typescript
// GroupController.ts
import { Request, Response } from 'express';
import { CreateGroupUseCase } from '../../core/use-cases/CreateGroupUseCase.js';
import { JoinGroupUseCase } from '../../core/use-cases/JoinGroupUseCase.js';

export class GroupController {
  constructor(
    private createGroupUseCase: CreateGroupUseCase,
    private joinGroupUseCase: JoinGroupUseCase
  ) {}

  create = async (req: Request, res: Response) => {
    const userId = req.auth!.userId; // From Clerk middleware

    const group = await this.createGroupUseCase.execute({
      ...req.body,
      creatorId: userId,
    });

    res.status(201).json({
      success: true,
      data: group,
    });
  };

  join = async (req: Request, res: Response) => {
    const userId = req.auth!.userId;

    const group = await this.joinGroupUseCase.execute({
      inviteCode: req.body.inviteCode,
      userId,
    });

    res.json({
      success: true,
      data: group,
    });
  };
}
```

**Files to create:**
1. ✅ `GroupController.ts`
2. ✅ `MediaController.ts`
3. ✅ `ClusterController.ts`

### D. Middleware (`presentation/middleware/`)

```typescript
// errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError.js';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};
```

**Files to create:**
1. ✅ `errorHandler.ts`
2. ✅ `asyncHandler.ts` - Wraps async route handlers
3. ✅ `validation.ts` - Zod validation middleware
4. ✅ `rateLimiter.ts`

### E. Routes (`presentation/routes/`)

```typescript
// groupRoutes.ts
import { Router } from 'express';
import { container } from '../../di/container.js';
import { GroupController } from '../controllers/GroupController.js';

const router = Router();
const controller = container.get<GroupController>('GroupController');

router.post('/', controller.create);
router.post('/join', controller.join);
router.get('/', controller.list);
router.get('/:id', controller.getById);

export default router;
```

**Files to create:**
1. ✅ `groupRoutes.ts`
2. ✅ `mediaRoutes.ts`
3. ✅ `clusterRoutes.ts`
4. ✅ `index.ts` - Combine all routes

## Step 3: Dependency Injection Container

```typescript
// di/container.ts
import { MongoUserRepository } from '../infrastructure/database/mongoose/repositories/UserRepository.js';
import { MongoGroupRepository } from '../infrastructure/database/mongoose/repositories/GroupRepository.js';
import { S3Service } from '../infrastructure/aws/S3Service.js';
import { RekognitionService } from '../infrastructure/aws/RekognitionService.js';
import { BullMQService } from '../infrastructure/queue/BullMQService.js';
import { ClerkService } from '../infrastructure/external/ClerkService.js';

import { CreateGroupUseCase } from '../core/use-cases/CreateGroupUseCase.js';
import { JoinGroupUseCase } from '../core/use-cases/JoinGroupUseCase.js';
import { UploadMediaUseCase } from '../core/use-cases/UploadMediaUseCase.js';

import { GroupController } from '../presentation/controllers/GroupController.js';

class Container {
  private services = new Map();

  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  get<T>(name: string): T {
    return this.services.get(name);
  }
}

const container = new Container();

// Register repositories
const userRepository = new MongoUserRepository();
const groupRepository = new MongoGroupRepository();
const mediaRepository = new MongoMediaRepository();

container.register('UserRepository', userRepository);
container.register('GroupRepository', groupRepository);
container.register('MediaRepository', mediaRepository);

// Register services
const s3Service = new S3Service();
const rekognitionService = new RekognitionService();
const queueService = new BullMQService();
const authService = new ClerkService(userRepository);

container.register('S3Service', s3Service);
container.register('RekognitionService', rekognitionService);
container.register('QueueService', queueService);
container.register('AuthService', authService);

// Register use cases
const createGroupUseCase = new CreateGroupUseCase(groupRepository, rekognitionService);
const joinGroupUseCase = new JoinGroupUseCase(groupRepository, userRepository);
const uploadMediaUseCase = new UploadMediaUseCase(
  mediaRepository,
  groupRepository,
  s3Service,
  queueService
);

container.register('CreateGroupUseCase', createGroupUseCase);
container.register('JoinGroupUseCase', joinGroupUseCase);
container.register('UploadMediaUseCase', uploadMediaUseCase);

// Register controllers
const groupController = new GroupController(createGroupUseCase, joinGroupUseCase);
container.register('GroupController', groupController);

export { container };
```

## Step 4: Main Application

```typescript
// index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { clerkMiddleware, requireAuth } from '@clerk/express';

import { env } from './config/env.js';
import { database } from './infrastructure/database/mongoose/connection.js';
import routes from './presentation/routes/index.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.get('CORS_ORIGIN') }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Clerk authentication
app.use(clerkMiddleware());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes (protected)
app.use(env.get('API_PREFIX'), requireAuth(), routes);

// Error handling
app.use(errorHandler);

// Start server
const start = async () => {
  try {
    await database.connect();

    const port = env.get('PORT');
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
```

## Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Run development:**
   ```bash
   npm run dev
   ```

## Testing

Create tests in `src/__tests__/`:

```typescript
// __tests__/use-cases/CreateGroup.test.ts
describe('CreateGroupUseCase', () => {
  it('should create a group', async () => {
    const mockRepo = new InMemoryGroupRepository();
    const mockService = new MockRekognitionService();
    const useCase = new CreateGroupUseCase(mockRepo, mockService);

    const group = await useCase.execute({
      name: 'Test Group',
      creatorId: 'user-123',
      inviteCode: 'ABC123',
    });

    expect(group.name).toBe('Test Group');
  });
});
```

## Next Steps

1. Complete all repository implementations
2. Complete all service implementations
3. Complete all controllers
4. Add comprehensive error handling
5. Add request validation
6. Add API documentation (Swagger)
7. Add unit tests
8. Add integration tests
9. Deploy to Railway/AWS
