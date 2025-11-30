import { Request, Response } from 'express';
import { GetClustersWithSamplesUseCase } from '../../core/use-cases/GetClustersWithSamplesUseCase.js';
import { GetClusterMediaUseCase } from '../../core/use-cases/GetClusterMediaUseCase.js';
import { MergeClustersUseCase } from '../../core/use-cases/MergeClustersUseCase.js';
import { IFaceClusterRepository } from '../../core/interfaces/repositories/IFaceClusterRepository.js';
import { IFaceClusterMemberRepository } from '../../core/interfaces/repositories/IFaceClusterRepository.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../../core/interfaces/repositories/IMediaRepository.js';
import { IFaceDetectionRepository } from '../../core/interfaces/repositories/IFaceDetectionRepository.js';
import { IStorageService } from '../../core/interfaces/services/IStorageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { RedisCacheService, CacheKeys, CacheTTL } from '../../infrastructure/cache/RedisCacheService.js';

export class ClusterController {
  constructor(
    private getClustersWithSamplesUseCase: GetClustersWithSamplesUseCase,
    private getClusterMediaUseCase: GetClusterMediaUseCase,
    private mergeClustersUseCase: MergeClustersUseCase,
    private clusterRepository: IFaceClusterRepository,
    private clusterMemberRepository: IFaceClusterMemberRepository,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceDetectionRepository: IFaceDetectionRepository,
    private storageService: IStorageService,
    private cacheService: RedisCacheService
  ) {}

  /**
   * List clusters for a group with sample photos
   * GET /api/groups/:groupId/clusters
   */
  listByGroup = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;

    // Cache clusters list (30 min TTL)
    const clusters = await this.cacheService.wrap(
      CacheKeys.clustersByGroup(groupId),
      async () => this.getClustersWithSamplesUseCase.execute(groupId, userId),
      CacheTTL.MEDIUM
    );

    return res.json({
      success: true,
      data: clusters,
    });
  });

  /**
   * Get media for a specific cluster
   * GET /api/clusters/:clusterId/media
   */
  getClusterMedia = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const clusterId = req.params.clusterId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Cache cluster media (30 min TTL)
    const cacheKey = `${CacheKeys.cluster(clusterId)}:media:page:${page}:limit:${limit}`;
    const result = await this.cacheService.wrap(
      cacheKey,
      async () => this.getClusterMediaUseCase.execute(clusterId, userId, page, limit),
      CacheTTL.MEDIUM
    );

    return res.json({
      success: true,
      data: result,
    });
  });

  /**
   * Update cluster name
   * PATCH /api/clusters/:clusterId
   */
  updateCluster = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const clusterId = req.params.clusterId;
    const { clusterName } = req.body;

    if (clusterName && clusterName.length > 50) {
      throw new BadRequestError('Cluster name must be 50 characters or less');
    }

    // Get the cluster
    const cluster = await this.clusterRepository.findById(clusterId);
    if (!cluster) {
      throw new NotFoundError('Cluster not found');
    }

    // Verify user has access to the group
    const group = await this.groupRepository.findByIdAndUserId(cluster.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this cluster');
    }

    // Update cluster name
    const updatedCluster = await this.clusterRepository.updateName(clusterId, clusterName);

    // Invalidate caches
    await this.cacheService.delete(CacheKeys.cluster(clusterId));
    await this.cacheService.delete(CacheKeys.clustersByGroup(cluster.groupId));
    await this.cacheService.deletePattern(`${CacheKeys.cluster(clusterId)}:media:*`);

    return res.json({
      success: true,
      data: updatedCluster,
      message: 'Cluster updated successfully',
    });
  });

  /**
   * Delete a cluster and all photos containing that person
   * DELETE /api/clusters/:clusterId
   * Admin only - deletes the cluster and ALL photos containing faces in that cluster
   */
  deleteCluster = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const clusterId = req.params.clusterId;

    // Get the cluster
    const cluster = await this.clusterRepository.findById(clusterId);
    if (!cluster) {
      throw new NotFoundError('Cluster not found');
    }

    // Verify user is admin of the group
    const group = await this.groupRepository.findByIdAndUserId(cluster.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this cluster');
    }

    // Check if user is admin
    if (!group.isAdmin(userId)) {
      throw new ForbiddenError('Admin access required to delete clusters');
    }

    console.log(`[Delete Cluster] Admin ${userId} deleting cluster ${clusterId} from group ${cluster.groupId}`);

    // Step 1: Find all cluster members
    const clusterMembers = await this.clusterMemberRepository.findByClusterId(clusterId);
    const faceDetectionIds = clusterMembers.map(m => m.faceDetectionId);

    console.log(`[Delete Cluster] Found ${faceDetectionIds.length} face detections in cluster`);

    // Step 2: Find all face detections and their media IDs
    const uniqueMediaIds = new Set<string>();
    for (const faceDetectionId of faceDetectionIds) {
      const faceDetection = await this.faceDetectionRepository.findById(faceDetectionId);
      if (faceDetection) {
        uniqueMediaIds.add(faceDetection.mediaId);
      }
    }

    const mediaIds = Array.from(uniqueMediaIds);
    console.log(`[Delete Cluster] Found ${mediaIds.length} unique media items to delete`);

    // Step 3: Delete all media items (this cascades to face detections and cluster members)
    let totalSizeFreed = 0;
    const s3KeysToDelete: string[] = [];

    for (const mediaId of mediaIds) {
      const media = await this.mediaRepository.findById(mediaId);
      if (media) {
        // Collect S3 keys and file sizes
        s3KeysToDelete.push(media.s3Key);
        totalSizeFreed += media.fileSize;

        // Delete all face detections for this media
        const allFaceDetections = await this.faceDetectionRepository.findByMediaId(mediaId);
        for (const fd of allFaceDetections) {
          // Delete cluster members for each face detection
          const member = await this.clusterMemberRepository.findByFaceDetectionId(fd.id);
          if (member) {
            await this.clusterMemberRepository.delete(member.id);
          }
          // Delete face detection
          await this.faceDetectionRepository.delete(fd.id);
        }

        // Delete media from database
        await this.mediaRepository.delete(mediaId);
      }
    }

    // Step 4: Delete from S3
    if (s3KeysToDelete.length > 0) {
      await this.storageService.deleteFiles(s3KeysToDelete);
      console.log(`[Delete Cluster] Deleted ${s3KeysToDelete.length} files from S3`);
    }

    // Step 5: Delete the cluster itself
    await this.clusterRepository.delete(clusterId);

    // Step 6: Update group storage usage
    await this.groupRepository.updateStorageUsed(cluster.groupId, -totalSizeFreed);

    // Step 7: Invalidate all relevant caches
    await this.cacheService.delete(CacheKeys.cluster(clusterId));
    await this.cacheService.delete(CacheKeys.clustersByGroup(cluster.groupId));
    await this.cacheService.deletePattern(`${CacheKeys.cluster(clusterId)}:media:*`);
    await this.cacheService.deletePattern(`media:group:${cluster.groupId}:page:*`);
    await this.cacheService.delete(CacheKeys.groupStorage(cluster.groupId));

    console.log(
      `[Delete Cluster] Successfully deleted cluster ${clusterId}, ${mediaIds.length} photos (${totalSizeFreed} bytes freed)`
    );

    return res.json({
      success: true,
      message: `Cluster deleted successfully. ${mediaIds.length} photo(s) removed.`,
      deletedPhotos: mediaIds.length,
    });
  });

  /**
   * Remove a face from a cluster
   * DELETE /api/clusters/:clusterId/faces/:faceDetectionId
   * Removes a specific face detection from a cluster without deleting the photo
   */
  removeFaceFromCluster = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const clusterId = req.params.clusterId;
    const faceDetectionId = req.params.faceDetectionId;

    // Get the cluster
    const cluster = await this.clusterRepository.findById(clusterId);
    if (!cluster) {
      throw new NotFoundError('Cluster not found');
    }

    // Verify user has access to the group
    const group = await this.groupRepository.findByIdAndUserId(cluster.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this cluster');
    }

    // Check if user is admin (only admin can modify clusters)
    if (!group.isAdmin(userId)) {
      throw new ForbiddenError('Admin access required to modify clusters');
    }

    console.log(`[Remove Face] Admin ${userId} removing face ${faceDetectionId} from cluster ${clusterId}`);

    // Find the cluster member for this face detection
    const clusterMember = await this.clusterMemberRepository.findByFaceDetectionId(faceDetectionId);
    if (!clusterMember || clusterMember.clusterId !== clusterId) {
      throw new NotFoundError('Face not found in this cluster');
    }

    // Delete the cluster member
    await this.clusterMemberRepository.delete(clusterMember.id);

    // Get remaining members to update cluster stats
    const remainingMembers = await this.clusterMemberRepository.findByClusterId(clusterId);

    if (remainingMembers.length === 0) {
      // Delete empty cluster
      await this.clusterRepository.delete(clusterId);
      console.log(`[Remove Face] Deleted empty cluster ${clusterId}`);

      // Invalidate caches
      await this.cacheService.delete(CacheKeys.cluster(clusterId));
      await this.cacheService.delete(CacheKeys.clustersByGroup(cluster.groupId));
      await this.cacheService.deletePattern(`${CacheKeys.cluster(clusterId)}:media:*`);

      return res.json({
        success: true,
        message: 'Face removed. Cluster deleted as it became empty.',
        clusterDeleted: true,
      });
    } else {
      // Update cluster appearance count
      const updatedCluster = cluster.updateStats(remainingMembers.length, cluster.confidence);
      await this.clusterRepository.update(clusterId, updatedCluster);
      console.log(`[Remove Face] Updated cluster ${clusterId} appearance count to ${remainingMembers.length}`);

      // Invalidate caches
      await this.cacheService.delete(CacheKeys.cluster(clusterId));
      await this.cacheService.delete(CacheKeys.clustersByGroup(cluster.groupId));
      await this.cacheService.deletePattern(`${CacheKeys.cluster(clusterId)}:media:*`);

      return res.json({
        success: true,
        message: 'Face removed from cluster successfully',
        clusterDeleted: false,
        remainingFaces: remainingMembers.length,
      });
    }
  });

  /**
   * Merge two clusters
   * POST /api/clusters/:clusterId/merge/:targetClusterId
   */
  mergeClusters = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const sourceClusterId = req.params.clusterId;
    const targetClusterId = req.params.targetClusterId;

    const mergedCluster = await this.mergeClustersUseCase.execute({
      sourceClusterId,
      targetClusterId,
      userId,
    });

    // Invalidate all cluster caches for this group
    await this.cacheService.delete(CacheKeys.cluster(sourceClusterId));
    await this.cacheService.delete(CacheKeys.cluster(targetClusterId));
    await this.cacheService.delete(CacheKeys.clustersByGroup(mergedCluster.groupId));
    await this.cacheService.deletePattern(`${CacheKeys.cluster(sourceClusterId)}:media:*`);
    await this.cacheService.deletePattern(`${CacheKeys.cluster(targetClusterId)}:media:*`);

    return res.json({
      success: true,
      data: mergedCluster,
      message: 'Clusters merged successfully',
    });
  });
}
