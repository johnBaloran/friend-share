# Face Media Backend - Clean Architecture

## Architecture Overview

This backend follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── core/              # Domain Layer (Pure Business Logic)
│   ├── entities/      # Domain models
│   ├── interfaces/    # Contracts (repositories & services)
│   └── use-cases/     # Application business rules
│
├── infrastructure/    # Infrastructure Layer (External Dependencies)
│   ├── database/      # Mongoose models & repositories
│   ├── aws/          # S3 & Rekognition services
│   ├── queue/        # BullMQ implementation
│   └── external/     # Clerk auth service
│
├── presentation/      # Presentation Layer (HTTP/API)
│   ├── controllers/   # Handle HTTP requests
│   ├── dto/          # Data Transfer Objects
│   ├── routes/       # Express routes
│   ├── middleware/   # Auth, validation, errors
│   └── validators/   # Request validation
│
└── shared/           # Shared utilities
    ├── types/        # TypeScript types
    ├── errors/       # Custom error classes
    ├── constants/    # App constants
    └── utils/        # Helper functions
```

## SOLID Principles

### 1. **Single Responsibility Principle (SRP)**
- Each class has one reason to change
- **Entities**: Domain logic only
- **Use Cases**: One business operation
- **Controllers**: Handle HTTP only
- **Services**: One external integration

### 2. **Open/Closed Principle (OCP)**
- Open for extension, closed for modification
- Add new use cases without modifying existing ones
- Add new storage providers by implementing `IStorageService`

### 3. **Liskov Substitution Principle (LSP)**
- Can swap implementations without breaking code
- Replace Clerk with JWT auth (both implement `IAuthService`)
- Replace S3 with Google Cloud Storage (both implement `IStorageService`)

### 4. **Interface Segregation Principle (ISP)**
- Clients depend only on interfaces they use
- Repositories have specific, focused methods
- Services expose only what's needed

### 5. **Dependency Inversion Principle (DIP)**
- High-level modules don't depend on low-level modules
- Both depend on abstractions (interfaces)
- **Core** defines interfaces, **Infrastructure** implements them

## Dependency Flow

```
Presentation → Core ← Infrastructure
     ↓           ↓          ↓
Controllers  Use Cases   Services
     ↓           ↓          ↓
   DTOs     Entities   Repositories
```

**Key Rule**: Dependencies point INWARD toward Core

## Installation

```bash
cd backend
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

## Running the Application

### Development
```bash
# Start API server
npm run dev

# Start workers (in separate terminal)
npm run worker:dev
```

### Production
```bash
# Build TypeScript
npm run build

# Start server
npm start

# Start workers
npm run worker
```

## API Architecture

### Example Request Flow

**Upload Media Endpoint:**

```
1. HTTP Request → Controller
   ↓
2. Controller validates DTO
   ↓
3. Controller calls Use Case
   ↓
4. Use Case orchestrates:
   - GroupRepository (check permissions)
   - StorageService (upload to S3)
   - MediaRepository (save records)
   - QueueService (queue face detection)
   ↓
5. Controller returns response
```

## Key Features

### ✅ **Clean Architecture**
- Framework-independent core
- Testable business logic
- Swappable infrastructure

### ✅ **SOLID Compliance**
- Dependency injection
- Interface-based design
- Single responsibility

### ✅ **Type Safety**
- Full TypeScript
- Zod validation
- Compile-time checks

### ✅ **Scalability**
- Repository pattern
- Queue-based processing
- Connection pooling

### ✅ **Security**
- Clerk authentication
- JWT validation
- Rate limiting
- Helmet headers

## Testing Strategy

### Unit Tests
```typescript
// Test use cases with mocks
const mockRepo = new InMemoryGroupRepository();
const mockService = new MockStorageService();
const useCase = new CreateGroupUseCase(mockRepo, mockService);

await useCase.execute({ name: 'Test Group', creatorId: '123' });
```

### Integration Tests
```typescript
// Test with real database
const groupRepo = new MongoGroupRepository();
const group = await groupRepo.create(testGroup);
```

## Adding New Features

### 1. Add Entity (if needed)
```typescript
// core/entities/NewFeature.ts
export class NewFeature { }
```

### 2. Add Repository Interface
```typescript
// core/interfaces/repositories/INewFeatureRepository.ts
export interface INewFeatureRepository {
  create(entity: NewFeature): Promise<NewFeature>;
}
```

### 3. Add Use Case
```typescript
// core/use-cases/CreateNewFeatureUseCase.ts
export class CreateNewFeatureUseCase {
  constructor(private repo: INewFeatureRepository) {}
  async execute(dto: CreateDto): Promise<NewFeature> { }
}
```

### 4. Implement Repository
```typescript
// infrastructure/database/mongoose/repositories/NewFeatureRepository.ts
export class MongoNewFeatureRepository implements INewFeatureRepository {
  async create(entity: NewFeature): Promise<NewFeature> { }
}
```

### 5. Add Controller
```typescript
// presentation/controllers/NewFeatureController.ts
export class NewFeatureController {
  constructor(private useCase: CreateNewFeatureUseCase) {}
  async create(req, res) { }
}
```

### 6. Add Route
```typescript
// presentation/routes/newFeature.ts
router.post('/', controller.create);
```

## Project Status

### ✅ Completed
- Clean Architecture setup
- Core entities & use cases
- Repository interfaces
- Service interfaces
- Shared utilities & errors

### 🚧 In Progress
- Mongoose models & repositories
- AWS services implementation
- Queue service implementation
- Presentation layer (controllers, routes)
- Dependency injection container

### 📋 TODO
- Complete infrastructure implementations
- Build presentation layer
- Add comprehensive tests
- Add API documentation (Swagger)
- Add monitoring & logging

## License

MIT
