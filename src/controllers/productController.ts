import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';
import cloudinary from '../config/cloudinary';
import { Product } from '../models/Product';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
}

const handleImageUpload = async (file: Express.Multer.File): Promise<CloudinaryUploadResult> => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'products',
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    
    // Clean up temporary file
    await fs.unlink(file.path);
    
    return result;
  } catch (error) {
    // Clean up temporary file even if upload fails
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Creating product with data:', req.body);
    console.log('Files received:', req.files);

    let images: Product['images'] = [];
    
    if (req.files && Array.isArray(req.files)) {
      console.log(`Processing ${req.files.length} images`);
      
      const uploadPromises = (req.files as Express.Multer.File[]).map(async (file, index) => {
        console.log(`Uploading image ${index + 1}:`, file.originalname);
        const result = await handleImageUpload(file);
        console.log(`Image ${index + 1} uploaded successfully:`, result.secure_url);
        
        return {
          id: uuidv4(),
          url: result.secure_url,
          order: index,
          publicId: result.public_id
        };
      });
      
      images = await Promise.all(uploadPromises);
      console.log('All images processed:', images);
    }

    // Create the product with images
    const productData = {
      ...req.body,
      images,
      inStock: req.body.stock > 0
    };

    console.log('Creating product with final data:', productData);
    const product = await productService.createProduct(productData);
    console.log('Product created successfully:', product);

    // Force cache invalidation to ensure updated data is returned
    await productService.invalidateCache();

    // Return the complete product data
    res.status(201).json(product);
  } catch (error) {
    console.error('Error in createProduct:', error);
    next(error);
  }
};

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.getAllProducts(req.query);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let images: string[] | undefined;
    if (req.files && Array.isArray(req.files)) {
      images = [];
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload((file as any).path, { folder: 'products' });
        images.push(result.secure_url);
      }
    } else if (req.file) {
      const result = await cloudinary.uploader.upload((req.file as any).path, { folder: 'products' });
      images = [result.secure_url];
    }
    const product = await productService.updateProduct(req.params.id, { ...req.body, images });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await productService.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

export const updateStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.updateProduct(req.params.id, { inStock: req.body.inStock });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const toggleFeatured = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.updateProduct(req.params.id, { featured: req.body.featured });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const uploadImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let newImages: Product['images'] = [];
    
    if (req.files && Array.isArray(req.files)) {
      const uploadPromises = (req.files as Express.Multer.File[]).map(async (file) => {
        const result = await handleImageUpload(file);
        return {
          id: uuidv4(),
          url: result.secure_url,
          order: (product.images?.length || 0) + newImages.length,
          publicId: result.public_id
        };
      });
      
      newImages = await Promise.all(uploadPromises);
    }

    const updatedProduct = await productService.updateProduct(req.params.id, {
      images: [...(product.images || []), ...newImages]
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Failed to update product' });
    }

    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: productId, imageId } = req.params;
    
    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const imageToDelete = product.images.find(img => img.id === imageId);
    if (!imageToDelete) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete from Cloudinary if publicId exists
    if (imageToDelete.publicId) {
      await cloudinary.uploader.destroy(imageToDelete.publicId);
    }

    // Remove image and reorder remaining images
    const updatedImages = product.images
      .filter(img => img.id !== imageId)
      .map((img, index) => ({ ...img, order: index }));

    const updatedProduct = await productService.updateProduct(productId, { images: updatedImages });
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export const reorderImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: productId } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ message: 'imageIds must be an array' });
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Create a map of existing images
    const imageMap = new Map(product.images.map(img => [img.id, img]));

    // Validate all imageIds exist
    if (!imageIds.every(id => imageMap.has(id))) {
      return res.status(400).json({ message: 'Invalid image ID provided' });
    }

    // Reorder images
    const updatedImages = imageIds.map((id, index) => ({
      ...imageMap.get(id)!,
      order: index
    }));

    const updatedProduct = await productService.updateProduct(productId, { images: updatedImages });
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
};
