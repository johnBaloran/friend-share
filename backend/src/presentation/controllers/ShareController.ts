import { Request, Response } from 'express';
import { CreateShareableLinkUseCase } from '../../core/use-cases/CreateShareableLinkUseCase.js';
import { GetSharedResourceUseCase } from '../../core/use-cases/GetSharedResourceUseCase.js';
import { RevokeShareableLinkUseCase } from '../../core/use-cases/RevokeShareableLinkUseCase.js';
import { ListShareableLinksUseCase } from '../../core/use-cases/ListShareableLinksUseCase.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { ResourceType } from '../../core/entities/ShareableLink.js';

export class ShareController {
  constructor(
    private createShareableLinkUseCase: CreateShareableLinkUseCase,
    private getSharedResourceUseCase: GetSharedResourceUseCase,
    private revokeShareableLinkUseCase: RevokeShareableLinkUseCase,
    private listShareableLinksUseCase: ListShareableLinksUseCase
  ) {}

  /**
   * Create a new shareable link
   * POST /api/share
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { resourceType, resourceId, permissions, expiresAt } = req.body;

    if (!resourceType || !resourceId) {
      throw new BadRequestError('resourceType and resourceId are required');
    }

    if (!['group', 'media', 'cluster'].includes(resourceType)) {
      throw new BadRequestError('Invalid resourceType. Must be: group, media, or cluster');
    }

    if (!permissions || typeof permissions.canView !== 'boolean') {
      throw new BadRequestError('Invalid permissions. canView is required');
    }

    const link = await this.createShareableLinkUseCase.execute({
      resourceType: resourceType as ResourceType,
      resourceId,
      userId,
      permissions: {
        canView: permissions.canView,
        canDownload: permissions.canDownload || false,
      },
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: link.id,
        token: link.token,
        resourceType: link.resourceType,
        resourceId: link.resourceId,
        permissions: link.permissions,
        expiresAt: link.expiresAt,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${link.token}`,
      },
      message: 'Shareable link created successfully',
    });
  });

  /**
   * Get shared resource by token (PUBLIC - no auth required)
   * GET /api/public/share/:token
   */
  getByToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token) {
      throw new BadRequestError('Token is required');
    }

    const result = await this.getSharedResourceUseCase.execute(token);

    return res.json({
      success: true,
      data: result,
    });
  });

  /**
   * List shareable links for a resource
   * GET /api/share/:resourceType/:resourceId
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { resourceType, resourceId } = req.params;

    if (!['group', 'media', 'cluster'].includes(resourceType)) {
      throw new BadRequestError('Invalid resourceType');
    }

    const links = await this.listShareableLinksUseCase.execute({
      resourceType: resourceType as ResourceType,
      resourceId,
      userId,
    });

    const linksWithUrls = links.map(link => ({
      id: link.id,
      token: link.token,
      resourceType: link.resourceType,
      resourceId: link.resourceId,
      permissions: link.permissions,
      expiresAt: link.expiresAt,
      isActive: link.isActive,
      accessCount: link.accessCount,
      createdAt: link.createdAt,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${link.token}`,
    }));

    return res.json({
      success: true,
      data: linksWithUrls,
    });
  });

  /**
   * Revoke a shareable link
   * DELETE /api/share/:linkId
   */
  revoke = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { linkId } = req.params;

    await this.revokeShareableLinkUseCase.execute({
      linkId,
      userId,
    });

    return res.json({
      success: true,
      message: 'Shareable link revoked successfully',
    });
  });
}
