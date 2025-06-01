import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';
import cloudinary from '../config/cloudinary';
import fs from 'fs/promises';
import path from 'path';

const handleImageUpload = async (file: Express.Multer.File) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'products',
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    
    // Clean up the temporary file
    await fs.unlink(file.path);
    
    return result.secure_url;
  } catch (error) {
    // Clean up the temporary file even if upload fails
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let images: string[] = [];
    
    if (req.files && Array.isArray(req.files)) {
      // Upload images in parallel
      const uploadPromises = (req.files as Express.Multer.File[]).map(handleImageUpload);
      images = await Promise.all(uploadPromises);
    } else if (req.file) { 
      // Multer single upload
      const result = await cloudinary.uploader.upload((req.file as any).path, { folder: 'products' });
      images = [result.secure_url];
    }
    const product = await productService.createProduct({ ...req.body, images });
    res.status(201).json(product);
  } catch (err) {
    next(err);
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

export const uploadImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let images: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload((file as any).path, { folder: 'products' });
        images.push(result.secure_url);
      }
    } else if (req.file) {
      const result = await cloudinary.uploader.upload((req.file as any).path, { folder: 'products' });
      images = [result.secure_url];
    }
    const product = await productService.updateProduct(req.params.id, { images });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.deleteImage(req.params.id, req.params.imageId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

export const reorderImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.reorderImages(req.params.id, req.body.imageOrder);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};
