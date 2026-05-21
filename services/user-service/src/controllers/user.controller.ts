import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { successResponse, NotFoundError, createLogger } from '@nexcart/shared';

const logger = createLogger('User-Service:Controller');

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    let profile = await prisma.userProfile.findUnique({ where: { id: userId }, include: { addresses: true } });
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { id: userId, name: req.headers['x-user-email'] as string },
        include: { addresses: true },
      });
    }
    res.json(successResponse(profile));
  } catch (error) { next(error); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { name, phone, dateOfBirth } = req.body;
    const profile = await prisma.userProfile.upsert({
      where: { id: userId },
      update: { ...(name && { name }), ...(phone && { phone }), ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }) },
      create: { id: userId, name: name || '', phone, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined },
      include: { addresses: true },
    });
    logger.info('Profile updated', { userId });
    res.json(successResponse(profile, 'Profile updated'));
  } catch (error) { next(error); }
}

export async function addAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { label, street, city, state, country, zipCode, isDefault } = req.body;
    if (isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await prisma.userProfile.upsert({ where: { id: userId }, update: {}, create: { id: userId, name: '' } });
    const address = await prisma.address.create({ data: { userId, label, street, city, state, country, zipCode, isDefault: isDefault || false } });
    res.status(201).json(successResponse(address, 'Address added'));
  } catch (error) { next(error); }
}

export async function updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { addressId } = req.params;
    const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new NotFoundError('Address');
    if (req.body.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const address = await prisma.address.update({ where: { id: addressId }, data: req.body });
    res.json(successResponse(address, 'Address updated'));
  } catch (error) { next(error); }
}

export async function deleteAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { addressId } = req.params;
    const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new NotFoundError('Address');
    await prisma.address.delete({ where: { id: addressId } });
    res.json(successResponse(null, 'Address deleted'));
  } catch (error) { next(error); }
}