import { IShareableLinkRepository } from '../../../../core/interfaces/repositories/IShareableLinkRepository.js';
import { ShareableLink, ResourceType } from '../../../../core/entities/ShareableLink.js';
import { ShareableLinkModel } from '../models/ShareableLinkModel.js';

export class MongoShareableLinkRepository implements IShareableLinkRepository {
  async create(link: ShareableLink): Promise<ShareableLink> {
    const doc = await ShareableLinkModel.create({
      token: link.token,
      resourceType: link.resourceType,
      resourceId: link.resourceId,
      createdBy: link.createdBy,
      permissions: link.permissions,
      expiresAt: link.expiresAt,
      isActive: link.isActive,
      accessCount: link.accessCount,
    });

    return this.toEntity(doc);
  }

  async findByToken(token: string): Promise<ShareableLink | null> {
    const doc = await ShareableLinkModel.findOne({ token });
    return doc ? this.toEntity(doc) : null;
  }

  async findById(id: string): Promise<ShareableLink | null> {
    const doc = await ShareableLinkModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByResource(resourceType: ResourceType, resourceId: string): Promise<ShareableLink[]> {
    const docs = await ShareableLinkModel.find({
      resourceType,
      resourceId,
      isActive: true,
    }).sort({ createdAt: -1 });

    return docs.map(doc => this.toEntity(doc));
  }

  async findByCreator(userId: string): Promise<ShareableLink[]> {
    const docs = await ShareableLinkModel.find({
      createdBy: userId,
    }).sort({ createdAt: -1 });

    return docs.map(doc => this.toEntity(doc));
  }

  async update(id: string, link: ShareableLink): Promise<ShareableLink> {
    const doc = await ShareableLinkModel.findByIdAndUpdate(
      id,
      {
        permissions: link.permissions,
        expiresAt: link.expiresAt,
        isActive: link.isActive,
        accessCount: link.accessCount,
      },
      { new: true }
    );

    if (!doc) {
      throw new Error(`ShareableLink ${id} not found`);
    }

    return this.toEntity(doc);
  }

  async delete(id: string): Promise<void> {
    await ShareableLinkModel.findByIdAndDelete(id);
  }

  async incrementAccessCount(id: string): Promise<void> {
    await ShareableLinkModel.findByIdAndUpdate(
      id,
      { $inc: { accessCount: 1 } }
    );
  }

  private toEntity(doc: any): ShareableLink {
    return new ShareableLink(
      doc._id.toString(),
      doc.token,
      doc.resourceType,
      doc.resourceId,
      doc.createdBy,
      {
        canView: doc.permissions.canView,
        canDownload: doc.permissions.canDownload,
      },
      doc.expiresAt,
      doc.isActive,
      doc.accessCount,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
