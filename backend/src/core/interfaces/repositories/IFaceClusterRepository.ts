import { FaceCluster, FaceClusterMember } from '../../entities/FaceCluster.js';
import { PaginationParams, PaginatedResponse } from '../../../shared/types/index.js';

export interface IFaceClusterRepository {
  create(cluster: FaceCluster): Promise<FaceCluster>;
  createMany(clusters: FaceCluster[]): Promise<FaceCluster[]>;
  findById(id: string): Promise<FaceCluster | null>;
  findByGroupId(groupId: string, pagination?: PaginationParams): Promise<PaginatedResponse<FaceCluster>>;
  update(id: string, data: Partial<FaceCluster>): Promise<FaceCluster | null>;
  delete(id: string): Promise<boolean>;
  deleteByGroupId(groupId: string): Promise<number>;
  updateName(id: string, name: string): Promise<FaceCluster | null>;
}

export interface IFaceClusterMemberRepository {
  create(member: FaceClusterMember): Promise<FaceClusterMember>;
  createMany(members: FaceClusterMember[]): Promise<FaceClusterMember[]>;
  findById(id: string): Promise<FaceClusterMember | null>;
  findByClusterId(clusterId: string): Promise<FaceClusterMember[]>;
  findByFaceDetectionId(faceDetectionId: string): Promise<FaceClusterMember | null>;
  delete(id: string): Promise<boolean>;
  deleteByClusterId(clusterId: string): Promise<number>;
  deleteByFaceDetectionId(faceDetectionId: string): Promise<number>;
  countByClusterId(clusterId: string): Promise<number>;
}
