import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../utils/helpers';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    const user = await userService.getUserById(userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    await userService.updateProfile(userId, req.body);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
};

export const getAddresses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    const addresses = await userService.getAddresses(userId);
    res.json(addresses);
  } catch (err) {
    next(err);
  }
};

export const addAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    const addressId = await userService.addAddress(userId, req.body);
    res.status(201).json({ addressId });
  } catch (err) {
    next(err);
  }
};

export const updateAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    await userService.updateAddress(userId, req.params.addressId, req.body);
    res.json({ message: 'Address updated' });
  } catch (err) {
    next(err);
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    await userService.deleteAddress(userId, req.params.addressId);
    res.json({ message: 'Address deleted' });
  } catch (err) {
    next(err);
  }
};

// Admin
export const getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user?.id === req.params.userId) {
      throw new CustomError('Cannot delete yourself', 400);
    }
    await userService.deleteUser(req.params.userId);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// Add methods for missing endpoints
export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) throw new CustomError('User not found', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await userService.updateProfile(req.params.id, req.body);
    res.json({ message: 'User updated' });
  } catch (err) {
    next(err);
  }
};
