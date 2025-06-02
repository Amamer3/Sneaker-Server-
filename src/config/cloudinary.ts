import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Missing Cloudinary credentials in environment variables');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
}

export class CloudinaryService {
  static readonly PRODUCT_FOLDER = 'products';
  
  static getImageUrl(publicId: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  } = {}) {
    const transformations = [];

    if (options.width || options.height) {
      transformations.push({
        width: options.width || 'auto',
        height: options.height || 'auto',
        crop: 'fill'
      });
    }

    transformations.push(
      {
        fetch_format: options.format || 'auto',
        quality: options.quality || 'auto'
      }
    );

    return cloudinary.url(publicId, {
      secure: true,
      transformation: transformations
    });
  }

  static async uploadImage(
    filePath: string,
    options: {
      folder?: string;
      width?: number;
      height?: number;
      quality?: number;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || this.PRODUCT_FOLDER,
        transformation: [
          {
            width: options.width || 800,
            height: options.height || 800,
            crop: 'limit'
          },
          {
            quality: options.quality || 'auto',
            fetch_format: 'auto'
          }
        ],
        resource_type: 'auto' as const // Fix the type here
      };

      const result = await cloudinary.uploader.upload(filePath, uploadOptions);
      
      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload image to Cloudinary');
    }
  }

  static async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }

  // Add a new method to validate image before upload
  static async validateImage(filePath: string): Promise<boolean> {
    try {
      const stats = await import('fs/promises').then(fs => fs.stat(filePath));
      // Check if file is too large (e.g., > 10MB)
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('File size too large');
      }
      return true;
    } catch (error) {
      console.error('Image validation error:', error);
      return false;
    }
  }
}

export default cloudinary;
