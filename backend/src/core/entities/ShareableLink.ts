import { nanoid } from 'nanoid';

export type ResourceType = 'group' | 'media' | 'cluster';

export interface SharePermissions {
  canView: boolean;
  canDownload: boolean;
}

export class ShareableLink {
  constructor(
    public readonly id: string,
    public readonly token: string,
    public readonly resourceType: ResourceType,
    public readonly resourceId: string,
    public readonly createdBy: string,
    public readonly permissions: SharePermissions,
    public readonly expiresAt: Date | null,
    public readonly isActive: boolean,
    public readonly accessCount: number,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(data: {
    resourceType: ResourceType;
    resourceId: string;
    createdBy: string;
    permissions: SharePermissions;
    expiresAt?: Date | null;
  }): ShareableLink {
    // Generate a secure, URL-safe token
    const token = nanoid(32);

    return new ShareableLink(
      '', // ID will be assigned by repository
      token,
      data.resourceType,
      data.resourceId,
      data.createdBy,
      data.permissions,
      data.expiresAt || null,
      true, // Active by default
      0, // Initial access count
      new Date(),
      new Date()
    );
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  isValid(): boolean {
    return this.isActive && !this.isExpired();
  }

  incrementAccessCount(): ShareableLink {
    return new ShareableLink(
      this.id,
      this.token,
      this.resourceType,
      this.resourceId,
      this.createdBy,
      this.permissions,
      this.expiresAt,
      this.isActive,
      this.accessCount + 1,
      this.createdAt,
      new Date()
    );
  }

  revoke(): ShareableLink {
    return new ShareableLink(
      this.id,
      this.token,
      this.resourceType,
      this.resourceId,
      this.createdBy,
      this.permissions,
      this.expiresAt,
      false, // Deactivate
      this.accessCount,
      this.createdAt,
      new Date()
    );
  }

  updatePermissions(permissions: SharePermissions): ShareableLink {
    return new ShareableLink(
      this.id,
      this.token,
      this.resourceType,
      this.resourceId,
      this.createdBy,
      permissions,
      this.expiresAt,
      this.isActive,
      this.accessCount,
      this.createdAt,
      new Date()
    );
  }

  updateExpiration(expiresAt: Date | null): ShareableLink {
    return new ShareableLink(
      this.id,
      this.token,
      this.resourceType,
      this.resourceId,
      this.createdBy,
      this.permissions,
      expiresAt,
      this.isActive,
      this.accessCount,
      this.createdAt,
      new Date()
    );
  }
}
