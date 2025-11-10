import { Request, Response } from 'express';
import { IGdprService } from '../../core/interfaces/services/IGdprService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export class GdprController {
  constructor(private gdprService: IGdprService) {}

  /**
   * Export all user data (GDPR Right to Access)
   * GET /api/gdpr/export
   */
  exportData = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;

    const exportedData = await this.gdprService.exportUserData(userId);

    return res.json({
      success: true,
      message: 'User data exported successfully',
      data: exportedData,
    });
  });

  /**
   * Delete all user data and account (GDPR Right to Erasure / Right to be Forgotten)
   * DELETE /api/gdpr/delete-account
   *
   * This is a destructive operation that:
   * - Deletes all groups created by the user
   * - Removes user from all other groups
   * - Deletes all media uploaded by the user
   * - Deletes all face data associated with the user
   * - Deletes the user account from both Clerk and the database
   */
  deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;

    const result = await this.gdprService.deleteUserData(userId);

    return res.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
      data: result.deletedItems,
    });
  });
}
