import { Router } from 'express';
import { getProfile, updateProfile, addAddress, updateAddress, deleteAddress } from '../controllers/user.controller';

export const userRouter = Router();

userRouter.get('/profile', getProfile);
userRouter.put('/profile', updateProfile);
userRouter.post('/addresses', addAddress);
userRouter.put('/addresses/:addressId', updateAddress);
userRouter.delete('/addresses/:addressId', deleteAddress);