import { Request, Response } from 'express';
import { CreateGroupUseCase } from '../../core/use-cases/CreateGroupUseCase.js';
import { JoinGroupUseCase } from '../../core/use-cases/JoinGroupUseCase.js';
import { UpdateGroupUseCase } from '../../core/use-cases/UpdateGroupUseCase.js';
import { DeleteGroupUseCase } from '../../core/use-cases/DeleteGroupUseCase.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../../core/interfaces/repositories/IMediaRepository.js';
import { IUserRepository } from '../../core/interfaces/repositories/IUserRepository.js';
import { IQueueService } from '../../core/interfaces/services/IQueueService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AppError.js';
import { MemberRole, JobType } from '../../shared/constants/index.js';
import { Group } from '../../core/entities/Group.js';
import { RedisCacheService, CacheKeys, CacheTTL } from '../../infrastructure/cache/RedisCacheService.js';

export class GroupController {
  constructor(
    private createGroupUseCase: CreateGroupUseCase,
    private joinGroupUseCase: JoinGroupUseCase,
    private updateGroupUseCase: UpdateGroupUseCase,
    private deleteGroupUseCase: DeleteGroupUseCase,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private userRepository: IUserRepository,
    private queueService: IQueueService,
    private cacheService: RedisCacheService
  ) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId; // From Clerk middleware

    const group = await this.createGroupUseCase.execute({
      name: req.body.name,
      description: req.body.description,
      storageLimit: req.body.storageLimit,
      autoDeleteDays: req.body.autoDeleteDays,
      creatorId: userId,
    });

    // Invalidate user's group list cache (including all paginated keys)
    await this.cacheService.deletePattern(`${CacheKeys.groupsByUser(userId)}*`);

    res.status(201).json({
      success: true,
      data: group,
    });
  });

  join = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;

    const group = await this.joinGroupUseCase.execute({
      inviteCode: req.body.inviteCode,
      userId,
    });

    // Invalidate caches
    await this.cacheService.deletePattern(`${CacheKeys.groupsByUser(userId)}*`); // New member's group list
    await this.cacheService.deletePattern(`${CacheKeys.group(group.id)}*`); // Group cache for all members
    await this.cacheService.delete(CacheKeys.groupMembers(group.id)); // Group members cache

    res.json({
      success: true,
      data: group,
      message: 'Successfully joined group',
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Use cache wrapper for group lists (30 min TTL)
    const cacheKey = `${CacheKeys.groupsByUser(userId)}:page:${page}:limit:${limit}`;
    const result = await this.cacheService.wrap(
      cacheKey,
      async () => this.groupRepository.findByUserId(userId, { page, limit }),
      CacheTTL.MEDIUM
    );

    const groupsWithUsers = await Promise.all(
      result.data.map(group => this.populateGroupMembers(group))
    );

    // Add media count for each group
    const groupsWithMediaCount = await Promise.all(
      groupsWithUsers.map(async (group) => {
        const mediaCount = await this.mediaRepository.countByGroupId(group.id);
        return {
          ...(typeof group.toJSON === 'function' ? group.toJSON() : group),
          mediaCount,
        };
      })
    );

    res.json({
      success: true,
      data: groupsWithMediaCount,
      pagination: result.pagination,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;

    // Use cache for group details (30 min TTL)
    const group = await this.cacheService.wrap(
      CacheKeys.group(groupId),
      async () => this.groupRepository.findByIdAndUserId(groupId, userId),
      CacheTTL.MEDIUM
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or you do not have access',
      });
    }

    const groupWithUsers = await this.populateGroupMembers(group);

    return res.json({
      success: true,
      data: groupWithUsers,
    });
  });

  /**
   * Get storage analytics for a group
   * GET /api/groups/:id/storage
   */
  getStorage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;

    // Use cache for storage analytics (5 min TTL for fresher data)
    const analytics = await this.cacheService.wrap(
      CacheKeys.groupStorage(groupId),
      async () => {
        // Verify user is admin of the group
        const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
        if (!group) {
          throw new NotFoundError('Group not found or you do not have access');
        }

        if (!group.isAdmin(userId)) {
          throw new ForbiddenError('Admin access required');
        }

        // Get media count
        const mediaCount = await this.mediaRepository.countByGroupId(groupId);

        return {
          storageUsed: group.storageUsed,
          storageLimit: group.storageLimit,
          storagePercentage: (group.storageUsed / group.storageLimit) * 100,
          mediaCount,
          storageRemaining: group.storageLimit - group.storageUsed,
        };
      },
      CacheTTL.SHORT
    );

    return res.json({
      success: true,
      data: analytics,
    });
  });

  /**
   * Get group members
   * GET /api/groups/:id/members
   */
  getMembers = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;

    // Use cache for group members (30 min TTL)
    const members = await this.cacheService.wrap(
      CacheKeys.groupMembers(groupId),
      async () => {
        // Verify user is a member of the group
        const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
        if (!group) {
          throw new NotFoundError('Group not found or you do not have access');
        }

        return group.members;
      },
      CacheTTL.MEDIUM
    );

    return res.json({
      success: true,
      data: members,
    });
  });

  /**
   * Update member role or permissions
   * PATCH /api/groups/:groupId/members/:memberId
   */
  updateMember = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { groupId, memberId } = req.params;
    const { role, permissions } = req.body;

    // Verify user is admin of the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    if (!group.isAdmin(userId)) {
      throw new ForbiddenError('Admin access required');
    }

    // Cannot update yourself
    if (userId === memberId) {
      throw new BadRequestError('Cannot update your own role or permissions');
    }

    // Validate member exists
    const member = group.getMember(memberId);
    if (!member) {
      throw new NotFoundError('Member not found in this group');
    }

    // Validate role if provided
    if (role && !Object.values(MemberRole).includes(role)) {
      throw new BadRequestError('Invalid role');
    }

    // Update the group using updateMember method
    const updatedGroup = group.updateMember(memberId, { role, permissions });

    // Save to repository
    const saved = await this.groupRepository.update(groupId, updatedGroup);

    // Invalidate caches
    await this.cacheService.delete(CacheKeys.group(groupId));
    await this.cacheService.delete(CacheKeys.groupMembers(groupId));
    await this.cacheService.deletePattern(`${CacheKeys.groupsByUser('*')}`);

    return res.json({
      success: true,
      data: saved,
      message: 'Member updated successfully',
    });
  });

  /**
   * Remove member from group
   * DELETE /api/groups/:groupId/members/:memberId
   */
  removeMember = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { groupId, memberId } = req.params;

    // Verify user is admin of the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    if (!group.isAdmin(userId)) {
      throw new ForbiddenError('Admin access required');
    }

    // Cannot remove yourself
    if (userId === memberId) {
      throw new BadRequestError('Cannot remove yourself from the group');
    }

    // Validate member exists
    const member = group.getMember(memberId);
    if (!member) {
      throw new NotFoundError('Member not found in this group');
    }

    // Remove member using repository
    await this.groupRepository.removeMember(groupId, memberId);

    // Invalidate caches
    await this.cacheService.delete(CacheKeys.group(groupId));
    await this.cacheService.delete(CacheKeys.groupMembers(groupId));
    await this.cacheService.deletePattern(`${CacheKeys.groupsByUser('*')}`);

    return res.json({
      success: true,
      message: 'Member removed successfully',
    });
  });

  /**
   * Trigger face reclustering for a group
   * POST /api/groups/:id/recluster
   */
  recluster = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;

    // Verify user is admin of the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    if (!group.isAdmin(userId)) {
      throw new ForbiddenError('Admin access required');
    }

    // Add face grouping job to queue
    const jobId = await this.queueService.addJob(
      'face-processing',
      JobType.FACE_GROUPING,
      {
        groupId,
        rekognitionCollectionId: group.rekognitionCollectionId,
      }
    );

    return res.json({
      success: true,
      data: {
        jobId,
        message: 'Face reclustering job started',
      },
    });
  });

  /**
   * Cleanup media in a group
   * POST /api/groups/:id/cleanup
   */
  cleanup = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;
    const { deleteOlderThan, deleteLargerThan, deleteUnprocessed } = req.body;

    // Verify user is admin of the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    if (!group.isAdmin(userId)) {
      throw new ForbiddenError('Admin access required');
    }

    let deletedCount = 0;
    let freedSpace = 0;

    // Delete old media
    if (deleteOlderThan) {
      const cutoffDate = new Date(deleteOlderThan);
      const oldMedia = await this.mediaRepository.findByGroupIdAndDate(groupId, null, cutoffDate);

      for (const media of oldMedia) {
        freedSpace += media.fileSize;
        await this.mediaRepository.delete(media.id);
        deletedCount++;
      }
    }

    // Delete large files
    if (deleteLargerThan) {
      const largeMedia = await this.mediaRepository.findByGroupIdAndSize(groupId, deleteLargerThan);

      for (const media of largeMedia) {
        freedSpace += media.fileSize;
        await this.mediaRepository.delete(media.id);
        deletedCount++;
      }
    }

    // Delete unprocessed media
    if (deleteUnprocessed) {
      const unprocessedMedia = await this.mediaRepository.findUnprocessedByGroupId(groupId);

      for (const media of unprocessedMedia) {
        freedSpace += media.fileSize;
        await this.mediaRepository.delete(media.id);
        deletedCount++;
      }
    }

    // Update group storage
    if (deletedCount > 0) {
      group.updateStorage(-freedSpace);
      await this.groupRepository.update(groupId, group);

      // Invalidate caches
      await this.cacheService.delete(CacheKeys.group(groupId));
      await this.cacheService.delete(CacheKeys.groupStorage(groupId));
      await this.cacheService.deletePattern(`media:group:${groupId}:page:*`);
    }

    return res.json({
      success: true,
      data: {
        deletedCount,
        freedSpace,
      },
      message: `Cleaned up ${deletedCount} files, freed ${Math.round(freedSpace / 1024 / 1024)} MB`,
    });
  });

  /**
   * Update group settings
   * PUT /api/groups/:id
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;
    const { name, description, storageLimit, autoDeleteDays } = req.body;

    const updatedGroup = await this.updateGroupUseCase.execute({
      groupId,
      userId,
      name,
      description,
      storageLimit,
      autoDeleteDays,
    });

    // Invalidate caches
    await this.cacheService.delete(CacheKeys.group(groupId));
    await this.cacheService.deletePattern(`${CacheKeys.groupsByUser('*')}`);

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Group updated successfully',
    });
  });

  /**
   * Delete group and all associated data
   * DELETE /api/groups/:id
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.id;

    await this.deleteGroupUseCase.execute({
      groupId,
      userId,
    });

    // Invalidate all caches for this group and user
    await this.cacheService.delete(CacheKeys.group(groupId));
    await this.cacheService.delete(CacheKeys.groupMembers(groupId));
    await this.cacheService.delete(CacheKeys.groupStorage(groupId));
    await this.cacheService.delete(CacheKeys.clustersByGroup(groupId));
    await this.cacheService.deletePattern(`${CacheKeys.groupsByUser('*')}`);
    await this.cacheService.deletePattern(`media:group:${groupId}:*`);

    return res.json({
      success: true,
      message: 'Group and all associated data deleted successfully',
    });
  });

  /**
   * Helper method to populate user information for group members
   */
  private async populateGroupMembers(group: Group): Promise<any> {
    const memberUserIds = group.members.map(m => m.userId);
    const users = await Promise.all(
      memberUserIds.map(userId => this.userRepository.findByClerkId(userId))
    );

    const membersWithUserInfo = group.members.map((member, index) => ({
      userId: users[index]
        ? {
            id: users[index]!.clerkId,
            name: users[index]!.name,
            email: users[index]!.email,
            avatar: users[index]!.avatar,
          }
        : {
            id: member.userId,
            name: null,
            email: null,
            avatar: null,
          },
      role: member.role,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
    }));

    return {
      ...group,
      members: membersWithUserInfo,
    };
  }
}
