export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailService {
  sendEmail(options: EmailOptions): Promise<void>;
  sendWelcomeEmail(userEmail: string, userName: string): Promise<void>;
  sendGroupInviteEmail(
    userEmail: string,
    userName: string,
    groupName: string,
    inviteCode: string
  ): Promise<void>;
  sendProcessingCompleteEmail(
    userEmail: string,
    userName: string,
    groupName: string,
    photoCount: number,
    faceCount: number
  ): Promise<void>;
  sendStorageWarningEmail(
    userEmail: string,
    userName: string,
    groupName: string,
    storageUsedMB: number,
    storageLimitMB: number,
    percentageUsed: number
  ): Promise<void>;
  sendDataExportReadyEmail(
    userEmail: string,
    userName: string,
    downloadUrl: string,
    expiresInHours: number
  ): Promise<void>;
}
