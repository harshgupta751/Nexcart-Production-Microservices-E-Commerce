import { Router } from 'express';
import { getCart, addItem, updateItem, removeItem, clearCart } from '../controllers/cart.controller';

export const cartRouter = Router();

cartRouter.get('/', getCart);
cartRouter.post('/items', addItem);
cartRouter.put('/items/:productId', updateItem);
cartRouter.delete('/items/:productId', removeItem);
cartRouter.delete('/', clearCart);