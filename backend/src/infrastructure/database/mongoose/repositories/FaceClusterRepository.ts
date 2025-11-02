import { IFaceClusterRepository, IFaceClusterMemberRepository } from '../../../../core/interfaces/repositories/IFaceClusterRepository.js';
import { FaceCluster, FaceClusterMember } from '../../../../core/entities/FaceCluster.js';
import { FaceClusterModel, IFaceClusterDocument } from '../models/FaceClusterModel.js';
import { FaceClusterMemberModel, IFaceClusterMemberDocument } from '../models/FaceClusterMemberModel.js';
import { PaginationParams, PaginatedResponse } from '../../../../shared/types/index.js';

export class MongoFaceClusterRepository implements IFaceClusterRepository {
  async create(cluster: FaceCluster): Promise<FaceCluster> {
    const doc = await FaceClusterModel.create({
      groupId: cluster.groupId,
      clusterName: cluster.clusterName,
      appearanceCount: cluster.appearanceCount,
      confidence: cluster.confidence,
    });

    return this.toEntity(doc);
  }

  async createMany(clusters: FaceCluster[]): Promise<FaceCluster[]> {
    const docs = await FaceClusterModel.insertMany(
      clusters.map(c => ({
        groupId: c.groupId,
        clusterName: c.clusterName,
        appearanceCount: c.appearanceCount,
        confidence: c.confidence,
      }))
    );

    return docs.map(doc => this.toEntity(doc as any));
  }

  async findById(id: string): Promise<FaceCluster | null> {
    const doc = await FaceClusterModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByGroupId(
    groupId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<FaceCluster>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      FaceClusterModel.find({ groupId })
        .sort({ appearanceCount: -1 })
        .skip(skip)
        .limit(limit),
      FaceClusterModel.countDocuments({ groupId }),
    ]);

    return {
      data: docs.map(doc => this.toEntity(doc)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, data: Partial<FaceCluster>): Promise<FaceCluster | null> {
    const doc = await FaceClusterModel.findByIdAndUpdate(id, data, { new: true });
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await FaceClusterModel.findByIdAndDelete(id);
    return !!result;
  }

  async deleteByGroupId(groupId: string): Promise<number> {
    const result = await FaceClusterModel.deleteMany({ groupId });
    return result.deletedCount || 0;
  }

  async updateName(id: string, name: string): Promise<FaceCluster | null> {
    const doc = await FaceClusterModel.findByIdAndUpdate(
      id,
      { clusterName: name },
      { new: true }
    );
    return doc ? this.toEntity(doc) : null;
  }

  private toEntity(doc: IFaceClusterDocument): FaceCluster {
    return new FaceCluster(
      (doc._id as any).toString(),
      (doc.groupId as any).toString(),
      doc.appearanceCount,
      doc.confidence,
      doc.clusterName,
      doc.createdAt,
      doc.updatedAt
    );
  }
}

export class MongoFaceClusterMemberRepository implements IFaceClusterMemberRepository {
  async create(member: FaceClusterMember): Promise<FaceClusterMember> {
    const doc = await FaceClusterMemberModel.create({
      clusterId: member.clusterId,
      faceDetectionId: member.faceDetectionId,
      confidence: member.confidence,
    });

    return this.toEntity(doc);
  }

  async createMany(members: FaceClusterMember[]): Promise<FaceClusterMember[]> {
    const docs = await FaceClusterMemberModel.insertMany(
      members.map(m => ({
        clusterId: m.clusterId,
        faceDetectionId: m.faceDetectionId,
        confidence: m.confidence,
      }))
    );

    return docs.map(doc => this.toEntity(doc as any));
  }

  async findById(id: string): Promise<FaceClusterMember | null> {
    const doc = await FaceClusterMemberModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByClusterId(clusterId: string): Promise<FaceClusterMember[]> {
    const docs = await FaceClusterMemberModel.find({ clusterId }).sort({ confidence: -1 });
    return docs.map(doc => this.toEntity(doc));
  }

  async findByFaceDetectionId(faceDetectionId: string): Promise<FaceClusterMember | null> {
    const doc = await FaceClusterMemberModel.findOne({ faceDetectionId });
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await FaceClusterMemberModel.findByIdAndDelete(id);
    return !!result;
  }

  async deleteByClusterId(clusterId: string): Promise<number> {
    const result = await FaceClusterMemberModel.deleteMany({ clusterId });
    return result.deletedCount || 0;
  }

  async deleteByFaceDetectionId(faceDetectionId: string): Promise<number> {
    const result = await FaceClusterMemberModel.deleteMany({ faceDetectionId });
    return result.deletedCount || 0;
  }

  async countByClusterId(clusterId: string): Promise<number> {
    return FaceClusterMemberModel.countDocuments({ clusterId });
  }

  private toEntity(doc: IFaceClusterMemberDocument): FaceClusterMember {
    return new FaceClusterMember(
      (doc._id as any).toString(),
      (doc.clusterId as any).toString(),
      (doc.faceDetectionId as any).toString(),
      doc.confidence,
      doc.createdAt
    );
  }
}
