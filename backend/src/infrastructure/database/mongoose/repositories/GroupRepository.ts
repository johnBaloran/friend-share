import { IGroupRepository } from '../../../../core/interfaces/repositories/IGroupRepository.js';
import { Group, GroupMember, MemberPermissions } from '../../../../core/entities/Group.js';
import { GroupModel, IGroupDocument } from '../models/GroupModel.js';
import { PaginationParams, PaginatedResponse } from '../../../../shared/types/index.js';

export class MongoGroupRepository implements IGroupRepository {
  async create(group: Group): Promise<Group> {
    const doc = await GroupModel.create({
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      creatorId: group.creatorId,
      members: group.members.map(m => ({
        userId: m.userId,
        role: m.role,
        permissions: {
          canUpload: m.permissions.canUpload,
          canDownload: m.permissions.canDownload,
          canDelete: m.permissions.canDelete,
        },
        joinedAt: m.joinedAt,
      })),
      storageLimit: group.storageLimit,
      storageUsed: group.storageUsed,
      autoDeleteDays: group.autoDeleteDays,
      rekognitionCollectionId: group.rekognitionCollectionId,
    });

    return this.toEntity(doc);
  }

  async findById(id: string): Promise<Group | null> {
    const doc = await GroupModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByIdAndUserId(groupId: string, userId: string): Promise<Group | null> {
    const doc = await GroupModel.findOne({
      _id: groupId,
      'members.userId': userId,
    });
    return doc ? this.toEntity(doc) : null;
  }

  async findByInviteCode(inviteCode: string): Promise<Group | null> {
    const doc = await GroupModel.findOne({ inviteCode: inviteCode.toUpperCase() });
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(
    userId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Group>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    const query = { 'members.userId': userId };

    const [docs, total] = await Promise.all([
      GroupModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      GroupModel.countDocuments(query),
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

  async update(id: string, group: Group): Promise<Group | null> {
    const doc = await GroupModel.findByIdAndUpdate(
      id,
      {
        name: group.name,
        description: group.description,
        members: group.members.map(m => ({
          userId: m.userId,
          role: m.role,
          permissions: {
            canUpload: m.permissions.canUpload,
            canDownload: m.permissions.canDownload,
            canDelete: m.permissions.canDelete,
          },
          joinedAt: m.joinedAt,
        })),
        storageLimit: group.storageLimit,
        storageUsed: group.storageUsed,
        autoDeleteDays: group.autoDeleteDays,
        rekognitionCollectionId: group.rekognitionCollectionId,
      },
      { new: true }
    );

    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await GroupModel.findByIdAndDelete(id);
    return !!result;
  }

  async updateStorageUsed(groupId: string, bytesChange: number): Promise<void> {
    await GroupModel.findByIdAndUpdate(groupId, {
      $inc: { storageUsed: bytesChange },
    });
  }

  async addMember(groupId: string, userId: string, role: string): Promise<Group | null> {
    const doc = await GroupModel.findByIdAndUpdate(
      groupId,
      {
        $push: {
          members: {
            userId,
            role,
            permissions: MemberPermissions.forRole(role as any),
            joinedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    return doc ? this.toEntity(doc) : null;
  }

  async removeMember(groupId: string, userId: string): Promise<Group | null> {
    const doc = await GroupModel.findByIdAndUpdate(
      groupId,
      {
        $pull: { members: { userId } },
      },
      { new: true }
    );

    return doc ? this.toEntity(doc) : null;
  }

  async getMemberCount(groupId: string): Promise<number> {
    const doc = await GroupModel.findById(groupId);
    return doc ? doc.members.length : 0;
  }

  private toEntity(doc: IGroupDocument): Group {
    const members = doc.members.map(
      m =>
        new GroupMember(
          (m.userId as any).toString(),
          m.role,
          new MemberPermissions(
            m.permissions.canUpload,
            m.permissions.canDownload,
            m.permissions.canDelete
          ),
          m.joinedAt
        )
    );

    return new Group(
      (doc._id as any).toString(),
      doc.name,
      doc.inviteCode,
      (doc.creatorId as any).toString(),
      members,
      doc.storageLimit,
      doc.storageUsed,
      doc.autoDeleteDays,
      doc.description,
      doc.rekognitionCollectionId,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
