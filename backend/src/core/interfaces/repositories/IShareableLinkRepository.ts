import { ShareableLink, ResourceType } from '../../entities/ShareableLink.js';

export interface IShareableLinkRepository {
  /**
   * Create a new shareable link
   */
  create(link: ShareableLink): Promise<ShareableLink>;

  /**
   * Find a shareable link by its unique token
   */
  findByToken(token: string): Promise<ShareableLink | null>;

  /**
   * Find a shareable link by ID
   */
  findById(id: string): Promise<ShareableLink | null>;

  /**
   * Find all shareable links for a specific resource
   */
  findByResource(resourceType: ResourceType, resourceId: string): Promise<ShareableLink[]>;

  /**
   * Find all shareable links created by a user
   */
  findByCreator(userId: string): Promise<ShareableLink[]>;

  /**
   * Update a shareable link
   */
  update(id: string, link: ShareableLink): Promise<ShareableLink>;

  /**
   * Delete a shareable link
   */
  delete(id: string): Promise<void>;

  /**
   * Increment access count for a link
   */
  incrementAccessCount(id: string): Promise<void>;
}
