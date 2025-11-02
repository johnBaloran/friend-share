import { Group } from '../entities/Group.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IFaceRecognitionService } from '../interfaces/services/IFaceRecognitionService.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export interface CreateGroupDto {
  name: string;
  creatorId: string;
  description?: string;
  storageLimit?: number;
  autoDeleteDays?: number;
}

export class CreateGroupUseCase {
  constructor(
    private readonly groupRepository: IGroupRepository,
    private readonly faceRecognitionService: IFaceRecognitionService
  ) {}

  async execute(dto: CreateGroupDto): Promise<Group> {
    // Validate input
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestError('Group name is required');
    }

    if (!dto.creatorId) {
      throw new BadRequestError('Creator ID is required');
    }

    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    // Create group entity
    const group = Group.create({
      name: dto.name.trim(),
      creatorId: dto.creatorId,
      inviteCode,
      description: dto.description,
      storageLimit: dto.storageLimit,
      autoDeleteDays: dto.autoDeleteDays,
    });

    // Save to database
    const savedGroup = await this.groupRepository.create(group);

    // Create AWS Rekognition collection for face recognition
    try {
      const collectionId = await this.faceRecognitionService.createCollection(savedGroup.id);
      const updatedGroup = savedGroup.setRekognitionCollection(collectionId);
      await this.groupRepository.update(savedGroup.id, updatedGroup);

      return updatedGroup;
    } catch (error) {
      // If collection creation fails, still return the group
      // The collection can be created later
      console.error('Failed to create Rekognition collection:', error);
      return savedGroup;
    }
  }

  private generateInviteCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }
}
