/**
 * GDPR Compliance Service Interface
 * Handles user data export and deletion according to GDPR requirements
 */
export interface IGdprService {
  /**
   * Export all user data in a portable format (GDPR Right to Access)
   * @param userId - The ID of the user requesting data export
   * @returns Object containing all user data
   */
  exportUserData(userId: string): Promise<{
    user: any;
    groups: any[];
    uploadedMedia: any[];
    faceClusters: any[];
    exportedAt: Date;
  }>;

  /**
   * Delete all user data and account (GDPR Right to Erasure)
   * @param userId - The ID of the user requesting deletion
   * @returns Success status
   */
  deleteUserData(userId: string): Promise<{
    success: boolean;
    deletedItems: {
      groups: number;
      media: number;
      faceClusters: number;
      faces: number;
    };
  }>;
}
