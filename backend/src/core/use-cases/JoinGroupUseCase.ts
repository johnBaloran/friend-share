import { Group } from '../entities/Group.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IUserRepository } from '../interfaces/repositories/IUserRepository.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { MemberRole } from '../../shared/constants/index.js';

export interface JoinGroupDto {
  inviteCode: string;
  userId: string;
}

export class JoinGroupUseCase {
  constructor(
    private readonly groupRepository: IGroupRepository,
    private readonly userRepository: IUserRepository
  ) {}

  async execute(dto: JoinGroupDto): Promise<Group> {
    // Validate input
    if (!dto.inviteCode || dto.inviteCode.trim().length === 0) {
      throw new BadRequestError('Invite code is required');
    }

    if (!dto.userId) {
      throw new BadRequestError('User ID is required');
    }

    // Verify user exists
    const user = await this.userRepository.findByClerkId(dto.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Find group by invite code
    const group = await this.groupRepository.findByInviteCode(dto.inviteCode.trim().toUpperCase());
    if (!group) {
      throw new NotFoundError('Invalid invite code');
    }

    // Check if user is already a member
    if (group.isMember(dto.userId)) {
      throw new ForbiddenError('You are already a member of this group');
    }

    // Add user as member
    const updatedGroup = group.addMember(dto.userId, MemberRole.MEMBER);

    // Save to database
    const savedGroup = await this.groupRepository.update(group.id, updatedGroup);
    if (!savedGroup) {
      throw new Error('Failed to join group');
    }

    return savedGroup;
  }
}
