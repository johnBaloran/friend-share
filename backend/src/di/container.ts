// Repositories
import { MongoUserRepository } from '../infrastructure/database/mongoose/repositories/UserRepository.js';
import { MongoGroupRepository } from '../infrastructure/database/mongoose/repositories/GroupRepository.js';
import { MongoMediaRepository } from '../infrastructure/database/mongoose/repositories/MediaRepository.js';
import { MongoFaceDetectionRepository } from '../infrastructure/database/mongoose/repositories/FaceDetectionRepository.js';
import {
  MongoFaceClusterRepository,
  MongoFaceClusterMemberRepository,
} from '../infrastructure/database/mongoose/repositories/FaceClusterRepository.js';
import { MongoShareableLinkRepository } from '../infrastructure/database/mongoose/repositories/ShareableLinkRepository.js';

// Services
import { S3Service } from '../infrastructure/aws/S3Service.js';
import { RekognitionService } from '../infrastructure/aws/RekognitionService.js';
import { FaceEnhancementService } from '../infrastructure/aws/FaceEnhancementService.js';
import { FaceClusteringService } from '../infrastructure/aws/FaceClusteringService.js';
import { BullMQService } from '../infrastructure/queue/BullMQService.js';
import { ClerkService } from '../infrastructure/external/ClerkService.js';
import { GdprService } from '../core/services/GdprService.js';
import { RedisCacheService } from '../infrastructure/cache/RedisCacheService.js';
import { EmailService } from '../infrastructure/email/EmailService.js';

// Use Cases
import { CreateGroupUseCase } from '../core/use-cases/CreateGroupUseCase.js';
import { JoinGroupUseCase } from '../core/use-cases/JoinGroupUseCase.js';
import { UpdateGroupUseCase } from '../core/use-cases/UpdateGroupUseCase.js';
import { DeleteGroupUseCase } from '../core/use-cases/DeleteGroupUseCase.js';
import { UploadMediaUseCase } from '../core/use-cases/UploadMediaUseCase.js';
import { GetClustersWithSamplesUseCase } from '../core/use-cases/GetClustersWithSamplesUseCase.js';
import { GetClusterMediaUseCase } from '../core/use-cases/GetClusterMediaUseCase.js';
import { MergeClustersUseCase } from '../core/use-cases/MergeClustersUseCase.js';
import { CreateShareableLinkUseCase } from '../core/use-cases/CreateShareableLinkUseCase.js';
import { GetSharedResourceUseCase } from '../core/use-cases/GetSharedResourceUseCase.js';
import { RevokeShareableLinkUseCase } from '../core/use-cases/RevokeShareableLinkUseCase.js';
import { ListShareableLinksUseCase } from '../core/use-cases/ListShareableLinksUseCase.js';

// Controllers
import { GroupController } from '../presentation/controllers/GroupController.js';
import { MediaController } from '../presentation/controllers/MediaController.js';
import { ClusterController } from '../presentation/controllers/ClusterController.js';
import { JobController } from '../presentation/controllers/JobController.js';
import { WebhookController } from '../presentation/controllers/WebhookController.js';
import { GdprController } from '../presentation/controllers/GdprController.js';
import { ShareController } from '../presentation/controllers/ShareController.js';

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
const shareableLinkRepository = new MongoShareableLinkRepository();

container.register('UserRepository', userRepository);
container.register('GroupRepository', groupRepository);
container.register('MediaRepository', mediaRepository);
container.register('FaceDetectionRepository', faceDetectionRepository);
container.register('FaceClusterRepository', faceClusterRepository);
container.register('FaceClusterMemberRepository', faceClusterMemberRepository);
container.register('ShareableLinkRepository', shareableLinkRepository);

// Register Infrastructure Services
const s3Service = new S3Service();
const rekognitionService = new RekognitionService();
const faceEnhancementService = new FaceEnhancementService();
const faceClusteringService = new FaceClusteringService(rekognitionService);
const queueService = new BullMQService();
const authService = new ClerkService(userRepository);
const cacheService = new RedisCacheService();
const emailService = new EmailService();

container.register('S3Service', s3Service);
container.register('RekognitionService', rekognitionService);
container.register('FaceEnhancementService', faceEnhancementService);
container.register('FaceClusteringService', faceClusteringService);
container.register('QueueService', queueService);
container.register('AuthService', authService);
container.register('CacheService', cacheService);
container.register('EmailService', emailService);

// Register Core Services
const gdprService = new GdprService(
  userRepository,
  groupRepository,
  mediaRepository,
  faceClusterRepository,
  s3Service,
  authService
);
container.register('GdprService', gdprService);

// Register Use Cases
const createGroupUseCase = new CreateGroupUseCase(groupRepository, rekognitionService);
const joinGroupUseCase = new JoinGroupUseCase(groupRepository, userRepository);
const updateGroupUseCase = new UpdateGroupUseCase(groupRepository);
const deleteGroupUseCase = new DeleteGroupUseCase(
  groupRepository,
  mediaRepository,
  faceDetectionRepository,
  faceClusterRepository,
  s3Service,
  rekognitionService
);
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
const mergeClustersUseCase = new MergeClustersUseCase(
  faceClusterRepository,
  faceClusterMemberRepository,
  groupRepository
);
const createShareableLinkUseCase = new CreateShareableLinkUseCase(
  shareableLinkRepository,
  groupRepository,
  mediaRepository,
  faceClusterRepository
);
const getSharedResourceUseCase = new GetSharedResourceUseCase(
  shareableLinkRepository,
  groupRepository,
  mediaRepository,
  faceClusterRepository,
  faceClusterMemberRepository,
  faceDetectionRepository,
  s3Service
);
const revokeShareableLinkUseCase = new RevokeShareableLinkUseCase(
  shareableLinkRepository,
  groupRepository,
  mediaRepository,
  faceClusterRepository
);
const listShareableLinksUseCase = new ListShareableLinksUseCase(
  shareableLinkRepository,
  groupRepository,
  mediaRepository,
  faceClusterRepository
);

container.register('CreateGroupUseCase', createGroupUseCase);
container.register('JoinGroupUseCase', joinGroupUseCase);
container.register('UpdateGroupUseCase', updateGroupUseCase);
container.register('DeleteGroupUseCase', deleteGroupUseCase);
container.register('UploadMediaUseCase', uploadMediaUseCase);
container.register('GetClustersWithSamplesUseCase', getClustersWithSamplesUseCase);
container.register('GetClusterMediaUseCase', getClusterMediaUseCase);
container.register('MergeClustersUseCase', mergeClustersUseCase);
container.register('CreateShareableLinkUseCase', createShareableLinkUseCase);
container.register('GetSharedResourceUseCase', getSharedResourceUseCase);
container.register('RevokeShareableLinkUseCase', revokeShareableLinkUseCase);
container.register('ListShareableLinksUseCase', listShareableLinksUseCase);

// Register Controllers
const groupController = new GroupController(
  createGroupUseCase,
  joinGroupUseCase,
  updateGroupUseCase,
  deleteGroupUseCase,
  groupRepository,
  mediaRepository,
  userRepository,
  queueService,
  cacheService
);
const mediaController = new MediaController(
  uploadMediaUseCase,
  mediaRepository,
  groupRepository,
  s3Service,
  faceDetectionRepository,
  faceClusterRepository,
  faceClusterMemberRepository,
  cacheService
);
const clusterController = new ClusterController(
  getClustersWithSamplesUseCase,
  getClusterMediaUseCase,
  mergeClustersUseCase,
  faceClusterRepository,
  faceClusterMemberRepository,
  groupRepository,
  mediaRepository,
  faceDetectionRepository,
  s3Service,
  cacheService
);
const jobController = new JobController(
  queueService,
  groupRepository,
  cacheService
);
const webhookController = new WebhookController(authService, emailService);
const gdprController = new GdprController(gdprService);
const shareController = new ShareController(
  createShareableLinkUseCase,
  getSharedResourceUseCase,
  revokeShareableLinkUseCase,
  listShareableLinksUseCase
);

container.register('GroupController', groupController);
container.register('MediaController', mediaController);
container.register('ClusterController', clusterController);
container.register('JobController', jobController);
container.register('WebhookController', webhookController);
container.register('GdprController', gdprController);
container.register('ShareController', shareController);

export { container };
