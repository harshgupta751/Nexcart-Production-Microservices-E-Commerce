import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../utils/redis';
import { successResponse, NotFoundError, ValidationError, createLogger, Cart, CartItem, CACHE_KEYS, CACHE_TTL } from '@nexcart/shared';

const logger = createLogger('Cart-Service:Controller');

export async function getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const cart = await fetchCart(userId);
    res.json(successResponse(cart));
  } catch (error) { next(error); }
}

export async function addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { productId, name, price, quantity, image, variantId } = req.body;
    if (quantity < 1) throw new ValidationError([{ message: 'Quantity must be at least 1' }]);

    const cart = await fetchCart(userId);
    const existingIndex = cart.items.findIndex((item) => item.productId === productId && item.variantId === variantId);

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, name, price, quantity, image, variantId });
    }

    cart.total = calculateTotal(cart.items);
    cart.updatedAt = new Date();
    await saveCart(userId, cart);

    logger.info('Item added to cart', { userId, productId });
    res.json(successResponse(cart, 'Item added to cart'));
  } catch (error) { next(error); }
}

export async function updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { productId } = req.params;
    const { quantity } = req.body;

    const cart = await fetchCart(userId);
    const itemIndex = cart.items.findIndex((item) => item.productId === productId);
    if (itemIndex < 0) throw new NotFoundError('Cart item');

    if (quantity <= 0) { cart.items.splice(itemIndex, 1); }
    else { cart.items[itemIndex].quantity = quantity; }

    cart.total = calculateTotal(cart.items);
    cart.updatedAt = new Date();
    await saveCart(userId, cart);
    res.json(successResponse(cart, 'Cart updated'));
  } catch (error) { next(error); }
}

export async function removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { productId } = req.params;
    const cart = await fetchCart(userId);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    cart.total = calculateTotal(cart.items);
    cart.updatedAt = new Date();
    await saveCart(userId, cart);
    res.json(successResponse(cart, 'Item removed'));
  } catch (error) { next(error); }
}

export async function clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    await redisClient.del(CACHE_KEYS.CART(userId));
    logger.info('Cart cleared', { userId });
    res.json(successResponse(null, 'Cart cleared'));
  } catch (error) { next(error); }
}

async function fetchCart(userId: string): Promise<Cart> {
  const data = await redisClient.get(CACHE_KEYS.CART(userId));
  if (!data) return { userId, items: [], total: 0, updatedAt: new Date() };
  return JSON.parse(data) as Cart;
}

async function saveCart(userId: string, cart: Cart): Promise<void> {
  await redisClient.setex(CACHE_KEYS.CART(userId), CACHE_TTL.CART, JSON.stringify(cart));
}

function calculateTotal(items: CartItem[]): number {
  return Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
}