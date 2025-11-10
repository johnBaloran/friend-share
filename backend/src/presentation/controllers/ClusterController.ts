import { Request, Response } from 'express';
import { GetClustersWithSamplesUseCase } from '../../core/use-cases/GetClustersWithSamplesUseCase.js';
import { GetClusterMediaUseCase } from '../../core/use-cases/GetClusterMediaUseCase.js';
import { MergeClustersUseCase } from '../../core/use-cases/MergeClustersUseCase.js';
import { IFaceClusterRepository } from '../../core/interfaces/repositories/IFaceClusterRepository.js';
import { IFaceClusterMemberRepository } from '../../core/interfaces/repositories/IFaceClusterRepository.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
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
   * Delete a cluster
   * DELETE /api/clusters/:clusterId
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

    // Delete cluster members first
    await this.clusterMemberRepository.deleteByClusterId(clusterId);

    // Delete the cluster
    await this.clusterRepository.delete(clusterId);

    // Invalidate caches
    await this.cacheService.delete(CacheKeys.cluster(clusterId));
    await this.cacheService.delete(CacheKeys.clustersByGroup(cluster.groupId));
    await this.cacheService.deletePattern(`${CacheKeys.cluster(clusterId)}:media:*`);

    return res.json({
      success: true,
      message: 'Cluster deleted successfully',
    });
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
