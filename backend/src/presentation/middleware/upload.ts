import multer from 'multer';
import { BadRequestError } from '../../shared/errors/AppError.js';

// Configure multer for in-memory storage
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Invalid file type: ${file.mimetype}. Only images are allowed.`));
  }
};

// Multer upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 50, // Max 50 files per upload
  },
});

// Middleware for handling upload errors
export const handleUploadError = (err: any, _req: any, _res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError('File size exceeds 50MB limit'));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new BadRequestError('Maximum 50 files allowed per upload'));
    }
    return next(new BadRequestError(`Upload error: ${err.message}`));
  }
  return next(err);
};
