import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AppError.js';
import { Group } from '../entities/Group.js';

/**
 * UpdateGroupUseCase
 *
 * Follows Single Responsibility Principle:
 * - Only responsible for updating group settings
 * - Delegates persistence to repository
 * - Delegates authorization to Group entity
 *
 * Follows Dependency Inversion Principle:
 * - Depends on IGroupRepository abstraction, not concrete implementation
 */

export interface UpdateGroupDTO {
  groupId: string;
  userId: string;
  name?: string;
  description?: string;
  storageLimit?: number;
  autoDeleteDays?: number;
}

export class UpdateGroupUseCase {
  constructor(private groupRepository: IGroupRepository) {}

  async execute(dto: UpdateGroupDTO): Promise<Group> {
    // Validate input
    this.validateInput(dto);

    // Fetch group
    const group = await this.groupRepository.findById(dto.groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Check authorization - only admins can update group
    if (!group.isAdmin(dto.userId)) {
      throw new ForbiddenError('Only group admins can update group settings');
    }

    // Validate business rules
    this.validateBusinessRules(dto, group);

    // Apply updates using immutable entity method
    const updatedGroup = group.update({
      name: dto.name,
      description: dto.description,
      storageLimit: dto.storageLimit,
      autoDeleteDays: dto.autoDeleteDays,
    });

    // Persist changes
    const savedGroup = await this.groupRepository.update(dto.groupId, updatedGroup);
    if (!savedGroup) {
      throw new Error('Failed to update group');
    }

    return savedGroup;
  }

  private validateInput(dto: UpdateGroupDTO): void {
    if (!dto.groupId || !dto.userId) {
      throw new BadRequestError('Group ID and User ID are required');
    }

    // At least one field must be provided for update
    if (!dto.name && !dto.description && !dto.storageLimit && !dto.autoDeleteDays) {
      throw new BadRequestError('At least one field must be provided for update');
    }

    // Validate name length if provided
    if (dto.name !== undefined) {
      if (dto.name.trim().length < 3) {
        throw new BadRequestError('Group name must be at least 3 characters');
      }
      if (dto.name.length > 100) {
        throw new BadRequestError('Group name must not exceed 100 characters');
      }
    }

    // Validate description length if provided
    if (dto.description !== undefined && dto.description.length > 500) {
      throw new BadRequestError('Description must not exceed 500 characters');
    }
  }

  private validateBusinessRules(dto: UpdateGroupDTO, group: Group): void {
    // Storage limit cannot be less than current usage
    if (dto.storageLimit !== undefined) {
      if (dto.storageLimit < 0) {
        throw new BadRequestError('Storage limit must be a positive number');
      }
      if (dto.storageLimit < group.storageUsed) {
        throw new BadRequestError(
          `Storage limit cannot be less than current usage (${Math.round(group.storageUsed / 1024 / 1024)} MB)`
        );
      }
    }

    // Auto-delete days validation
    if (dto.autoDeleteDays !== undefined) {
      if (dto.autoDeleteDays < 0) {
        throw new BadRequestError('Auto-delete days must be a positive number or 0 to disable');
      }
      if (dto.autoDeleteDays > 365) {
        throw new BadRequestError('Auto-delete days cannot exceed 365 days');
      }
    }
  }
}
