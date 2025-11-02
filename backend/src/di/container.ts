// Repositories
import { MongoUserRepository } from '../infrastructure/database/mongoose/repositories/UserRepository.js';
import { MongoGroupRepository } from '../infrastructure/database/mongoose/repositories/GroupRepository.js';
import { MongoMediaRepository } from '../infrastructure/database/mongoose/repositories/MediaRepository.js';
import { MongoFaceDetectionRepository } from '../infrastructure/database/mongoose/repositories/FaceDetectionRepository.js';
import {
  MongoFaceClusterRepository,
  MongoFaceClusterMemberRepository,
} from '../infrastructure/database/mongoose/repositories/FaceClusterRepository.js';

// Services
import { S3Service } from '../infrastructure/aws/S3Service.js';
import { RekognitionService } from '../infrastructure/aws/RekognitionService.js';
import { FaceEnhancementService } from '../infrastructure/aws/FaceEnhancementService.js';
import { BullMQService } from '../infrastructure/queue/BullMQService.js';
import { ClerkService } from '../infrastructure/external/ClerkService.js';

// Use Cases
import { CreateGroupUseCase } from '../core/use-cases/CreateGroupUseCase.js';
import { JoinGroupUseCase } from '../core/use-cases/JoinGroupUseCase.js';
import { UploadMediaUseCase } from '../core/use-cases/UploadMediaUseCase.js';
import { GetClustersWithSamplesUseCase } from '../core/use-cases/GetClustersWithSamplesUseCase.js';
import { GetClusterMediaUseCase } from '../core/use-cases/GetClusterMediaUseCase.js';

// Controllers
import { GroupController } from '../presentation/controllers/GroupController.js';
import { MediaController } from '../presentation/controllers/MediaController.js';
import { ClusterController } from '../presentation/controllers/ClusterController.js';
import { JobController } from '../presentation/controllers/JobController.js';
import { WebhookController } from '../presentation/controllers/WebhookController.js';

class Container {
  private services = new Map<string, any>();

  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }
}

// Initialize container
const container = new Container();

// Register Repositories
const userRepository = new MongoUserRepository();
const groupRepository = new MongoGroupRepository();
const mediaRepository = new MongoMediaRepository();
const faceDetectionRepository = new MongoFaceDetectionRepository();
const faceClusterRepository = new MongoFaceClusterRepository();
const faceClusterMemberRepository = new MongoFaceClusterMemberRepository();

container.register('UserRepository', userRepository);
container.register('GroupRepository', groupRepository);
container.register('MediaRepository', mediaRepository);
container.register('FaceDetectionRepository', faceDetectionRepository);
container.register('FaceClusterRepository', faceClusterRepository);
container.register('FaceClusterMemberRepository', faceClusterMemberRepository);

// Register Infrastructure Services
const s3Service = new S3Service();
const rekognitionService = new RekognitionService();
const faceEnhancementService = new FaceEnhancementService();
const queueService = new BullMQService();
const authService = new ClerkService(userRepository);

container.register('S3Service', s3Service);
container.register('RekognitionService', rekognitionService);
container.register('FaceEnhancementService', faceEnhancementService);
container.register('QueueService', queueService);
container.register('AuthService', authService);

// Register Use Cases
const createGroupUseCase = new CreateGroupUseCase(groupRepository, rekognitionService);
const joinGroupUseCase = new JoinGroupUseCase(groupRepository, userRepository);
const uploadMediaUseCase = new UploadMediaUseCase(
  mediaRepository,
  groupRepository,
  s3Service,
  queueService
);
const getClustersWithSamplesUseCase = new GetClustersWithSamplesUseCase(
  faceClusterRepository,
  faceClusterMemberRepository,
  faceDetectionRepository,
  mediaRepository,
  groupRepository,
  s3Service
);
const getClusterMediaUseCase = new GetClusterMediaUseCase(
  faceClusterRepository,
  faceClusterMemberRepository,
  faceDetectionRepository,
  mediaRepository,
  groupRepository,
  s3Service
);

container.register('CreateGroupUseCase', createGroupUseCase);
container.register('JoinGroupUseCase', joinGroupUseCase);
container.register('UploadMediaUseCase', uploadMediaUseCase);
container.register('GetClustersWithSamplesUseCase', getClustersWithSamplesUseCase);
container.register('GetClusterMediaUseCase', getClusterMediaUseCase);

// Register Controllers
const groupController = new GroupController(
  createGroupUseCase,
  joinGroupUseCase,
  groupRepository,
  mediaRepository,
  userRepository,
  queueService
);
const mediaController = new MediaController(
  uploadMediaUseCase,
  mediaRepository,
  groupRepository,
  s3Service
);
const clusterController = new ClusterController(
  getClustersWithSamplesUseCase,
  getClusterMediaUseCase,
  faceClusterRepository,
  faceClusterMemberRepository,
  groupRepository
);
const jobController = new JobController(
  queueService,
  groupRepository
);
const webhookController = new WebhookController(authService);

container.register('GroupController', groupController);
container.register('MediaController', mediaController);
container.register('ClusterController', clusterController);
container.register('JobController', jobController);
container.register('WebhookController', webhookController);

export { container };
