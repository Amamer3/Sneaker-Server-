import { Request, Response, NextFunction } from 'express';
import { categoryService, CategoryService } from '../services/categoryService';
import { CustomError } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth';

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { parent } = req.query;
    
    let categories;
    if (parent === 'root' || parent === null) {
      categories = await categoryService.getRootCategories();
    } else if (parent) {
      categories = await categoryService.getSubcategories(parent as string);
    } else {
      categories = await categoryService.getAllCategories();
    }
    
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const category = await categoryService.getCategoryById(id);
    
    if (!category) {
      throw new CustomError('Category not found', 404);
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const category = await categoryService.getCategoryBySlug(slug);
    
    if (!category) {
      throw new CustomError('Category not found', 404);
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, image, parentId, isActive = true, sortOrder } = req.body;
    
    if (!name || !description) {
      throw new CustomError('Name and description are required', 400);
    }
    
    // Generate slug from name if not provided
    const slug = req.body.slug || CategoryService.generateSlug(name);
    
    const categoryData = {
      name: name.trim(),
      slug,
      description: description.trim(),
      image,
      parentId: parentId || null,
      isActive,
      sortOrder: sortOrder || 0
    };
    
    const category = await categoryService.createCategory(categoryData);
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Generate slug if name is being updated and slug is not provided
    if (updateData.name && !updateData.slug) {
      updateData.slug = CategoryService.generateSlug(updateData.name);
    }
    
    const category = await categoryService.updateCategory(id, updateData);
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    await categoryService.deleteCategory(id);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getSubcategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const subcategories = await categoryService.getSubcategories(id);
    
    res.json({
      success: true,
      data: subcategories,
      count: subcategories.length
    });
  } catch (error) {
    next(error);
  }
};
