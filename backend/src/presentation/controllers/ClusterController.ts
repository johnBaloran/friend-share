import { Request, Response } from 'express';
import { GetClustersWithSamplesUseCase } from '../../core/use-cases/GetClustersWithSamplesUseCase.js';
import { GetClusterMediaUseCase } from '../../core/use-cases/GetClusterMediaUseCase.js';
import { IFaceClusterRepository } from '../../core/interfaces/repositories/IFaceClusterRepository.js';
import { IFaceClusterMemberRepository } from '../../core/interfaces/repositories/IFaceClusterRepository.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';

export class ClusterController {
  constructor(
    private getClustersWithSamplesUseCase: GetClustersWithSamplesUseCase,
    private getClusterMediaUseCase: GetClusterMediaUseCase,
    private clusterRepository: IFaceClusterRepository,
    private clusterMemberRepository: IFaceClusterMemberRepository,
    private groupRepository: IGroupRepository
  ) {}

  /**
   * List clusters for a group with sample photos
   * GET /api/groups/:groupId/clusters
   */
  listByGroup = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;

    const clusters = await this.getClustersWithSamplesUseCase.execute(groupId, userId);

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

    const result = await this.getClusterMediaUseCase.execute(clusterId, userId, page, limit);

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

    return res.json({
      success: true,
      message: 'Cluster deleted successfully',
    });
  });
}
