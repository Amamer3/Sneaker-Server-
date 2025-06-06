import { Request, Response } from 'express';
import * as deliveryService from '../services/deliveryService';

export const getDeliveryOptions = async (_req: Request, res: Response) => {
  try {
    const options = await deliveryService.getDeliveryOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery options' });
  }
};

export const validateDeliveryAddress = async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    const validationResult = await deliveryService.validateAddress(address);
    res.json(validationResult);
  } catch (error) {
    res.status(500).json({ message: 'Error validating address' });
  }
};
