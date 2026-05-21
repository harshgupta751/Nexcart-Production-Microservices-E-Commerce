import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model';
import { redisClient } from '../utils/redis';
import {
  successResponse,
  NotFoundError,
  createLogger,
  getPaginationParams,
  buildPagination,
  CACHE_KEYS,
  CACHE_TTL,
} from '@nexcart/shared';

const logger = createLogger('Product-Service:Controller');

export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip, take } = getPaginationParams(
      req.query.page as string | undefined,
      req.query.limit as string | undefined
    );
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice as string) : undefined;

    const cacheKey = CACHE_KEYS.PRODUCTS_LIST(page, take, category);

    if (!search && !minPrice && !maxPrice) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit', { cacheKey });
        res.json(JSON.parse(cached));
        return;
      }
    }

    const query: Record<string, any> = { isActive: true };
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }
    if (search) query.$text = { $search: search };

    const [products, total] = await Promise.all([
      Product.find(query).skip(skip).limit(take).select('-__v').sort({ createdAt: -1 }),
      Product.countDocuments(query),
    ]);

    const response = successResponse(products, undefined, buildPagination(total, page, take));

    if (!search && !minPrice && !maxPrice) {
      await redisClient.setex(cacheKey, CACHE_TTL.PRODUCTS_LIST, JSON.stringify(response));
      logger.debug('Cache set', { cacheKey });
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const cacheKey = CACHE_KEYS.PRODUCT(id);

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit', { cacheKey });
      res.json(JSON.parse(cached));
      return;
    }

    const product = await Product.findById(id).select('-__v');
    if (!product || !product.isActive) throw new NotFoundError('Product');

    const response = successResponse(product);
    await redisClient.setex(cacheKey, CACHE_TTL.PRODUCT, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await Product.create(req.body);
    await invalidateProductListCache();
    logger.info('Product created', { productId: product.id, sku: product.sku });
    res.status(201).json(successResponse(product, 'Product created'));
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!product) throw new NotFoundError('Product');
    await Promise.all([
      redisClient.del(CACHE_KEYS.PRODUCT(id)),
      invalidateProductListCache(),
    ]);
    logger.info('Product updated', { productId: id });
    res.json(successResponse(product, 'Product updated'));
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) throw new NotFoundError('Product');
    await Promise.all([
      redisClient.del(CACHE_KEYS.PRODUCT(id)),
      invalidateProductListCache(),
    ]);
    logger.info('Product deactivated', { productId: id });
    res.json(successResponse(null, 'Product deleted'));
  } catch (error) {
    next(error);
  }
}

export async function decreaseInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body as { items: { productId: string; quantity: number }[] };
    await Promise.all(
      items.map(({ productId, quantity }) =>
        Product.findByIdAndUpdate(productId, { $inc: { inventory: -quantity } }, { new: true })
      )
    );
    await invalidateProductListCache();
    res.json(successResponse(null, 'Inventory updated'));
  } catch (error) {
    next(error);
  }
}

async function invalidateProductListCache(): Promise<void> {
  const keys = await redisClient.keys('products:list:*');
  if (keys.length > 0) await redisClient.del(...keys);
}