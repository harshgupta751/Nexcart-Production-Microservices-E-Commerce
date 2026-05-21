import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  tags: string[];
  inventory: number;
  sku: string;
  isActive: boolean;
  variants: { name: string; options: Record<string, string>; price: number; inventory: number; sku: string; }[];
  ratings: { average: number; count: number };
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true, index: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number, min: 0 },
  images: [{ type: String }],
  category: { type: String, required: true, index: true },
  tags: [{ type: String, index: true }],
  inventory: { type: Number, required: true, default: 0, min: 0 },
  sku: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true, index: true },
  variants: [{ name: String, options: { type: Map, of: String }, price: Number, inventory: Number, sku: String }],
  ratings: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);