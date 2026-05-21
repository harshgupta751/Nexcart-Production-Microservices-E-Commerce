import { Router } from 'express';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, decreaseInventory } from '../controllers/product.controller';

export const productRouter = Router();

productRouter.get('/', getProducts);
productRouter.get('/:id', getProduct);
productRouter.post('/', createProduct);
productRouter.put('/:id', updateProduct);
productRouter.delete('/:id', deleteProduct);
productRouter.post('/internal/decrease-inventory', decreaseInventory);