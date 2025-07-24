import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Missing Cloudinary credentials in environment variables');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000, // 60 seconds timeout
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
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
          resource_type: 'auto' as const,
          timeout: 60000 // 60 seconds timeout per upload
        };

        const result = await cloudinary.uploader.upload(filePath, uploadOptions);
        
        return {
          public_id: result.public_id,
          secure_url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format
        };
      } catch (error: any) {
        lastError = error;
        console.error(`Cloudinary upload error (attempt ${attempt}/${maxRetries}):`, error);
        
        // If it's a timeout error and we have retries left, wait and retry
        if (attempt < maxRetries && (error.http_code === 499 || error.message?.includes('timeout'))) {
          console.log(`Retrying upload in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        // If it's the last attempt or a non-retryable error, throw
        break;
      }
    }
    
    throw new Error(`Failed to upload image to Cloudinary after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
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

  // Validate if a Cloudinary URL is still accessible
  static async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('URL validation error:', error);
      return false;
    }
  }

  // Extract public ID from Cloudinary URL
  static extractPublicId(url: string): string | null {
    try {
      const match = url.match(/\/v\d+\/(.+?)\.(jpg|jpeg|png|gif|webp)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error extracting public ID:', error);
      return null;
    }
  }
}

export default cloudinary;
