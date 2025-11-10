import { IFaceClusterRepository, IFaceClusterMemberRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AppError.js';
import { FaceCluster, FaceClusterMember } from '../entities/FaceCluster.js';

/**
 * MergeClustersUseCase
 *
 * Follows Single Responsibility Principle:
 * - Only responsible for merging two face clusters
 * - Delegates data access to repositories
 * - Delegates authorization to Group entity
 *
 * Follows Dependency Inversion Principle:
 * - Depends on repository abstractions, not concrete implementations
 *
 * Business Logic:
 * 1. Verify both clusters exist and belong to the same group
 * 2. Verify user has admin access to the group
 * 3. Move all members from source cluster to target cluster
 * 4. Recalculate target cluster statistics
 * 5. Delete source cluster
 * 6. Return updated target cluster
 */

export interface MergeClustersDTO {
  sourceClusterId: string;     // Cluster to merge FROM (will be deleted)
  targetClusterId: string;     // Cluster to merge INTO (will be kept)
  userId: string;              // User performing the merge
}

export class MergeClustersUseCase {
  constructor(
    private faceClusterRepository: IFaceClusterRepository,
    private faceClusterMemberRepository: IFaceClusterMemberRepository,
    private groupRepository: IGroupRepository
  ) {}

  async execute(dto: MergeClustersDTO): Promise<FaceCluster> {
    // Validate input
    this.validateInput(dto);

    // Fetch both clusters
    const sourceCluster = await this.faceClusterRepository.findById(dto.sourceClusterId);
    if (!sourceCluster) {
      throw new NotFoundError('Source cluster not found');
    }

    const targetCluster = await this.faceClusterRepository.findById(dto.targetClusterId);
    if (!targetCluster) {
      throw new NotFoundError('Target cluster not found');
    }

    // Validate clusters belong to the same group
    if (sourceCluster.groupId !== targetCluster.groupId) {
      throw new BadRequestError('Cannot merge clusters from different groups');
    }

    // Check user authorization (must be admin of the group)
    const group = await this.groupRepository.findById(sourceCluster.groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    if (!group.isAdmin(dto.userId)) {
      throw new ForbiddenError('Only group admins can merge face clusters');
    }

    console.log(`[MergeClusters] Merging cluster ${dto.sourceClusterId} into ${dto.targetClusterId}`);

    // Get members from both clusters
    const sourceMembers = await this.faceClusterMemberRepository.findByClusterId(dto.sourceClusterId);
    const targetMembers = await this.faceClusterMemberRepository.findByClusterId(dto.targetClusterId);

    console.log(`[MergeClusters] Source cluster has ${sourceMembers.length} members, target has ${targetMembers.length} members`);

    // Move all source members to target cluster by re-creating them
    const newMembers = sourceMembers.map(member => ({
      clusterId: dto.targetClusterId,
      faceDetectionId: member.faceDetectionId,
      confidence: member.confidence,
    }));

    if (newMembers.length > 0) {
      const membersToCreate = newMembers.map(data =>
        FaceClusterMember.create(data)
      );
      await this.faceClusterMemberRepository.createMany(membersToCreate);
    }

    // Calculate new statistics for merged cluster
    const allMembers = [...sourceMembers, ...targetMembers];
    const totalAppearances = sourceCluster.appearanceCount + targetCluster.appearanceCount;

    // Calculate average confidence weighted by cluster sizes
    const sourceWeight = sourceCluster.appearanceCount / totalAppearances;
    const targetWeight = targetCluster.appearanceCount / totalAppearances;
    const averageConfidence = (sourceCluster.confidence * sourceWeight) + (targetCluster.confidence * targetWeight);

    // Update target cluster with new stats
    const updatedTargetCluster = targetCluster.updateStats(
      totalAppearances,
      averageConfidence
    );

    // Preserve cluster name (prefer non-empty name)
    let finalCluster = updatedTargetCluster;
    if (!targetCluster.clusterName && sourceCluster.clusterName) {
      finalCluster = updatedTargetCluster.setName(sourceCluster.clusterName);
    }

    // Save updated target cluster
    const savedCluster = await this.faceClusterRepository.update(dto.targetClusterId, finalCluster);
    if (!savedCluster) {
      throw new Error('Failed to update target cluster');
    }

    // Delete source cluster (members already moved)
    await this.faceClusterMemberRepository.deleteByClusterId(dto.sourceClusterId);
    await this.faceClusterRepository.delete(dto.sourceClusterId);

    console.log(`[MergeClusters] Successfully merged clusters. New cluster has ${totalAppearances} appearances with confidence ${averageConfidence.toFixed(2)}`);

    return savedCluster;
  }

  private validateInput(dto: MergeClustersDTO): void {
    if (!dto.sourceClusterId || !dto.targetClusterId || !dto.userId) {
      throw new BadRequestError('Source cluster ID, target cluster ID, and user ID are required');
    }

    if (dto.sourceClusterId === dto.targetClusterId) {
      throw new BadRequestError('Cannot merge a cluster with itself');
    }
  }
}
