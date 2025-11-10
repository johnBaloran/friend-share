import { IGdprService } from '../interfaces/services/IGdprService.js';
import { IUserRepository } from '../interfaces/repositories/IUserRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IStorageService } from '../interfaces/services/IStorageService.js';
import { IAuthService } from '../interfaces/services/IAuthService.js';

export class GdprService implements IGdprService {
  constructor(
    private userRepository: IUserRepository,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceClusterRepository: IFaceClusterRepository,
    private storageService: IStorageService,
    private authService: IAuthService
  ) {}

  async exportUserData(userId: string) {
    // Get user data
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get all groups user is member of (get all with high limit)
    const groupsResponse = await this.groupRepository.findByUserId(userId, { page: 1, limit: 1000 });
    const groups = groupsResponse.data;

    // Get all media uploaded by user (across all groups)
    const uploadedMedia: any[] = [];
    for (const group of groups) {
      const media = await this.mediaRepository.findByUploader(group.id, userId);
      uploadedMedia.push(...media);
    }

    // Get all face clusters for user's groups
    const faceClusters: any[] = [];
    for (const group of groups) {
      const clustersResponse = await this.faceClusterRepository.findByGroupId(group.id, { page: 1, limit: 10000 });
      faceClusters.push(...clustersResponse.data);
    }

    return {
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        creatorId: group.creatorId,
        role: group.members.find((m) => m.userId === userId)?.role,
        storageUsed: group.storageUsed,
        storageLimit: group.storageLimit,
        createdAt: group.createdAt,
      })),
      uploadedMedia: uploadedMedia.map((media) => ({
        id: media.id,
        groupId: media.groupId,
        originalName: media.originalName,
        fileSize: media.fileSize,
        mimeType: media.mimeType,
        processed: media.processed,
        createdAt: media.createdAt,
      })),
      faceClusters: faceClusters.map((cluster) => ({
        id: cluster.id,
        groupId: cluster.groupId,
        clusterName: cluster.clusterName,
        appearanceCount: cluster.appearanceCount,
        confidence: cluster.confidence,
        createdAt: cluster.createdAt,
      })),
      exportedAt: new Date(),
    };
  }

  async deleteUserData(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let deletedGroups = 0;
    let deletedMedia = 0;
    let deletedClusters = 0;
    let deletedFaces = 0;

    // Get all groups user is member of (get all with high limit)
    const groupsResponse = await this.groupRepository.findByUserId(userId, { page: 1, limit: 1000 });
    const groups = groupsResponse.data;

    for (const group of groups) {
      // If user is the creator, delete entire group
      if (group.creatorId === userId) {
        // Delete all media in group from S3
        const allMedia = await this.mediaRepository.findByGroupId(group.id, {
          page: 1,
          limit: 10000, // Get all media
        });

        for (const media of allMedia.data) {
          await this.storageService.deleteFile(media.s3Key);
          await this.mediaRepository.delete(media.id);
          deletedMedia++;
        }

        // Delete all face clusters
        const clustersResponse = await this.faceClusterRepository.findByGroupId(group.id, { page: 1, limit: 10000 });
        for (const cluster of clustersResponse.data) {
          deletedFaces += cluster.appearanceCount;
          await this.faceClusterRepository.delete(cluster.id);
          deletedClusters++;
        }

        // Delete group
        await this.groupRepository.delete(group.id);
        deletedGroups++;
      } else {
        // Just remove user from group
        await this.groupRepository.removeMember(group.id, userId);

        // Delete media uploaded by this user in this group
        const userMedia = await this.mediaRepository.findByUploader(group.id, userId);
        for (const media of userMedia) {
          await this.storageService.deleteFile(media.s3Key);
          await this.mediaRepository.delete(media.id);
          deletedMedia++;

          // Update group storage
          await this.groupRepository.updateStorageUsed(group.id, -media.fileSize);
        }
      }
    }

    // Delete user from Clerk
    try {
      await this.authService.deleteUser(userId);
    } catch (error) {
      console.error('Failed to delete user from Clerk:', error);
      // Continue with database deletion even if Clerk deletion fails
    }

    // Delete user from database
    await this.userRepository.delete(userId);

    return {
      success: true,
      deletedItems: {
        groups: deletedGroups,
        media: deletedMedia,
        faceClusters: deletedClusters,
        faces: deletedFaces,
      },
    };
  }
}
