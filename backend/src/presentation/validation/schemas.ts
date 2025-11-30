import { z } from 'zod';

/**
 * Validation schemas for API requests
 * Using Zod for runtime type validation and sanitization
 */

// Group schemas
export const createGroupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Group name is required')
      .max(100, 'Group name must be less than 100 characters')
      .trim(),
    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .optional(),
    storageLimit: z
      .number()
      .int()
      .positive('Storage limit must be positive')
      .max(10737418240, 'Storage limit cannot exceed 10GB') // 10GB max
      .optional(),
    autoDeleteDays: z
      .number()
      .int()
      .min(1, 'Auto delete days must be at least 1')
      .max(365, 'Auto delete days cannot exceed 365')
      .optional(),
  }),
});

export const joinGroupSchema = z.object({
  body: z.object({
    inviteCode: z
      .string()
      .length(8, 'Invite code must be exactly 8 characters')
      .regex(/^[A-Z0-9]+$/, 'Invite code must contain only uppercase letters and numbers'),
  }),
});

export const updateMemberSchema = z.object({
  params: z.object({
    groupId: z.string().min(1, 'Group ID is required'),
    memberId: z.string().min(1, 'Member ID is required'),
  }),
  body: z.object({
    role: z
      .enum(['admin', 'member'], {
        message: 'Role must be either admin or member',
      })
      .optional(),
    permissions: z
      .object({
        canUpload: z.boolean().optional(),
        canDownload: z.boolean().optional(),
        canDelete: z.boolean().optional(),
        canShare: z.boolean().optional(),
      })
      .optional(),
  }),
});

// Cluster schemas
export const updateClusterSchema = z.object({
  params: z.object({
    clusterId: z.string().min(1, 'Cluster ID is required'),
  }),
  body: z.object({
    clusterName: z
      .string()
      .min(1, 'Cluster name cannot be empty')
      .max(100, 'Cluster name must be less than 100 characters')
      .trim(),
  }),
});

// Job schemas
export const getJobStatusSchema = z.object({
  params: z.object({
    jobId: z.string().min(1, 'Job ID is required'),
  }),
});

// Pagination schemas
export const paginationSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, 'Page must be greater than 0'),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  }),
});

// ID parameter validation
export const mongoIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
  }),
});

export const groupIdSchema = z.object({
  params: z.object({
    groupId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid group ID format'),
  }),
});

// Combined schemas for routes with both params and query
export const listGroupMediaSchema = groupIdSchema.merge(paginationSchema);
export const listGroupClustersSchema = groupIdSchema.merge(paginationSchema);
export const listGroupJobsSchema = groupIdSchema.merge(paginationSchema);

// Export types for TypeScript
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpdateClusterInput = z.infer<typeof updateClusterSchema>;
export type GetJobStatusInput = z.infer<typeof getJobStatusSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
