import { MemberRoleType } from '../../shared/types/index.js';
import { MemberRole, DEFAULTS } from '../../shared/constants/index.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';

export class MemberPermissions {
  constructor(
    public readonly canUpload: boolean,
    public readonly canDownload: boolean,
    public readonly canDelete: boolean
  ) {}

  static forRole(role: MemberRoleType): MemberPermissions {
    switch (role) {
      case MemberRole.ADMIN:
        return new MemberPermissions(true, true, true);
      case MemberRole.MEMBER:
        return new MemberPermissions(true, true, false);
      case MemberRole.VIEWER:
        return new MemberPermissions(false, true, false);
      default:
        return new MemberPermissions(false, false, false);
    }
  }
}

export class GroupMember {
  constructor(
    public readonly userId: string,
    public readonly role: MemberRoleType,
    public readonly permissions: MemberPermissions,
    public readonly joinedAt: Date = new Date()
  ) {}

  static create(userId: string, role: MemberRoleType = MemberRole.MEMBER): GroupMember {
    return new GroupMember(
      userId,
      role,
      MemberPermissions.forRole(role)
    );
  }

  updateRole(newRole: MemberRoleType): GroupMember {
    return new GroupMember(
      this.userId,
      newRole,
      MemberPermissions.forRole(newRole),
      this.joinedAt
    );
  }

  updatePermissions(permissions: Partial<MemberPermissions>): GroupMember {
    return new GroupMember(
      this.userId,
      this.role,
      new MemberPermissions(
        permissions.canUpload ?? this.permissions.canUpload,
        permissions.canDownload ?? this.permissions.canDownload,
        permissions.canDelete ?? this.permissions.canDelete
      ),
      this.joinedAt
    );
  }
}

export class Group {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly inviteCode: string,
    public readonly creatorId: string,
    public readonly members: GroupMember[],
    public readonly storageLimit: number,
    public readonly storageUsed: number,
    public readonly autoDeleteDays: number,
    public readonly description?: string,
    public readonly rekognitionCollectionId?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(data: {
    name: string;
    creatorId: string;
    inviteCode: string;
    description?: string;
    storageLimit?: number;
    autoDeleteDays?: number;
  }): Group {
    const creator = GroupMember.create(data.creatorId, MemberRole.ADMIN);

    return new Group(
      '', // ID will be assigned by repository
      data.name,
      data.inviteCode,
      data.creatorId,
      [creator],
      data.storageLimit ?? DEFAULTS.STORAGE_LIMIT,
      0, // Initial storage used
      data.autoDeleteDays ?? DEFAULTS.AUTO_DELETE_DAYS,
      data.description
    );
  }

  getMember(userId: string): GroupMember | undefined {
    return this.members.find(m => m.userId === userId);
  }

  isMember(userId: string): boolean {
    return this.members.some(m => m.userId === userId);
  }

  isAdmin(userId: string): boolean {
    const member = this.getMember(userId);
    return member?.role === MemberRole.ADMIN;
  }

  canUpload(userId: string): boolean {
    const member = this.getMember(userId);
    return member?.permissions.canUpload ?? false;
  }

  canDownload(userId: string): boolean {
    const member = this.getMember(userId);
    return member?.permissions.canDownload ?? false;
  }

  canDelete(userId: string): boolean {
    const member = this.getMember(userId);
    return member?.permissions.canDelete ?? false;
  }

  hasStorageSpace(fileSize: number): boolean {
    return (this.storageUsed + fileSize) <= this.storageLimit;
  }

  addMember(userId: string, role: MemberRoleType = MemberRole.MEMBER): Group {
    if (this.isMember(userId)) {
      throw new ForbiddenError('User is already a member');
    }

    const newMember = GroupMember.create(userId, role);
    return new Group(
      this.id,
      this.name,
      this.inviteCode,
      this.creatorId,
      [...this.members, newMember],
      this.storageLimit,
      this.storageUsed,
      this.autoDeleteDays,
      this.description,
      this.rekognitionCollectionId,
      this.createdAt,
      new Date()
    );
  }

  removeMember(userId: string): Group {
    if (userId === this.creatorId) {
      throw new ForbiddenError('Cannot remove group creator');
    }

    return new Group(
      this.id,
      this.name,
      this.inviteCode,
      this.creatorId,
      this.members.filter(m => m.userId !== userId),
      this.storageLimit,
      this.storageUsed,
      this.autoDeleteDays,
      this.description,
      this.rekognitionCollectionId,
      this.createdAt,
      new Date()
    );
  }

  updateMember(userId: string, updates: { role?: MemberRoleType; permissions?: Partial<MemberPermissions> }): Group {
    const members = this.members.map(member => {
      if (member.userId !== userId) return member;

      let updatedMember = member;
      if (updates.role) {
        updatedMember = updatedMember.updateRole(updates.role);
      }
      if (updates.permissions) {
        updatedMember = updatedMember.updatePermissions(updates.permissions);
      }
      return updatedMember;
    });

    return new Group(
      this.id,
      this.name,
      this.inviteCode,
      this.creatorId,
      members,
      this.storageLimit,
      this.storageUsed,
      this.autoDeleteDays,
      this.description,
      this.rekognitionCollectionId,
      this.createdAt,
      new Date()
    );
  }

  updateStorage(bytesAdded: number): Group {
    return new Group(
      this.id,
      this.name,
      this.inviteCode,
      this.creatorId,
      this.members,
      this.storageLimit,
      this.storageUsed + bytesAdded,
      this.autoDeleteDays,
      this.description,
      this.rekognitionCollectionId,
      this.createdAt,
      new Date()
    );
  }

  setRekognitionCollection(collectionId: string): Group {
    return new Group(
      this.id,
      this.name,
      this.inviteCode,
      this.creatorId,
      this.members,
      this.storageLimit,
      this.storageUsed,
      this.autoDeleteDays,
      this.description,
      collectionId,
      this.createdAt,
      new Date()
    );
  }

  update(data: { name?: string; description?: string; storageLimit?: number; autoDeleteDays?: number }): Group {
    return new Group(
      this.id,
      data.name ?? this.name,
      this.inviteCode,
      this.creatorId,
      this.members,
      data.storageLimit ?? this.storageLimit,
      this.storageUsed,
      data.autoDeleteDays ?? this.autoDeleteDays,
      data.description ?? this.description,
      this.rekognitionCollectionId,
      this.createdAt,
      new Date()
    );
  }
}
