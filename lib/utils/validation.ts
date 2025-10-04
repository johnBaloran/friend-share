import { z } from "zod";

// File validation schemas
export const imageFileSchema = z.object({
  name: z.string().min(1, "Filename is required"),
  size: z.number().max(10 * 1024 * 1024, "File size must be less than 10MB"),
  type: z
    .string()
    .refine((type) => type.startsWith("image/"), "File must be an image"),
});

export const fileUploadSchema = z.object({
  files: z.array(imageFileSchema).min(1, "At least one file is required"),
  groupId: z.string().min(1, "Group ID is required"),
});

// Text sanitization
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .trim()
    .substring(0, 1000); // Limit length
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-_.]/g, "")
    .substring(0, 255);
}

// Rate limiting utilities
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
  const now = Date.now();
  const windowData = rateLimitMap.get(key);

  if (!windowData || now > windowData.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (windowData.count >= maxRequests) {
    return false;
  }

  windowData.count += 1;
  return true;
}

// Validate MongoDB ObjectId
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Clean old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes
