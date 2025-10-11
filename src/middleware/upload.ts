import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/\s+/g, '-')}`);
  }
});

// Validate file content by checking magic numbers
const validateFileContent = (buffer: Buffer, expectedMimeType: string): boolean => {
  const magicNumbers: { [key: string]: number[][] } = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]]
  };

  const expectedMagic = magicNumbers[expectedMimeType];
  if (!expectedMagic) return false;

  return expectedMagic.some(magic => 
    magic.every((byte, index) => buffer[index] === byte)
  );
};

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image files are allowed!'));
    return;
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error('Only JPEG, PNG and WebP images are allowed!'));
    return;
  }

  // Check file size (additional check)
  if (file.size > 2 * 1024 * 1024) { // 2MB limit
    cb(new Error('File size must be less than 2MB!'));
    return;
  }

  // Check filename for malicious patterns
  const maliciousPatterns = [
    /\.\./,           // Path traversal
    /[<>:"|?*]/,      // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|aspx)$/i // Executable extensions
  ];

  if (maliciousPatterns.some(pattern => pattern.test(file.originalname))) {
    cb(new Error('Invalid filename!'));
    return;
  }
  
  cb(null, true);
};

const limits = {
  fileSize: 2 * 1024 * 1024, // 2MB - reduced for security
  files: 5
};

// Add post-processing validation
export const validateUploadedFile = (req: Request, res: Response, next: NextFunction): void => {
  const file = (req as any).file;
  if (file) {
    // Additional validation after upload
    
    // Check if file was actually uploaded
    if (!file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: 'Empty file uploaded' });
      return;
    }
    
    // Validate file content
    if (!validateFileContent(file.buffer, file.mimetype)) {
      // Clean up the file
      fs.unlink(file.path, () => {});
      res.status(400).json({ error: 'Invalid file content' });
      return;
    }
  }
  
  next();
};

export const upload = multer({ 
  storage, 
  fileFilter,
  limits
});
