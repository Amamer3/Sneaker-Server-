import { Request, Response } from 'express';

export const getAllCategories = async (req: Request, res: Response) => {
  res.send('Get all categories');
};

export const createCategory = async (req: Request, res: Response) => {
  res.send('Create category');
};

export const updateCategory = async (req: Request, res: Response) => {
  res.send('Update category');
};

export const deleteCategory = async (req: Request, res: Response) => {
  res.send('Delete category');
};
