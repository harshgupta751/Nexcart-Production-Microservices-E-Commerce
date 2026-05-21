'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Star } from 'lucide-react';
import { useCartStore } from '@/lib/store/cart.store';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: {
    _id?: string; id?: string; name: string; price: number; comparePrice?: number;
    images: string[]; category: string; ratings?: { average: number; count: number }; inventory: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const productId = product._id || product.id || '';
  const addItem = useCartStore((s) => s.addItem);
  const image = product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    try { await addItem({ productId, name: product.name, price: product.price, quantity: 1, image }); toast.success('Added to cart!'); }
    catch { toast.error('Failed to add to cart'); }
  }

  return (
    <Link href={`/products/${productId}`} className="card group cursor-pointer hover:shadow-md transition-shadow">
      <div className="relative overflow-hidden h-48 bg-gray-100">
        <Image src={image} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
        {product.comparePrice && product.comparePrice > product.price && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">SALE</span>
        )}
        {product.inventory === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-blue-700 font-medium mb-1 uppercase tracking-wide">{product.category}</p>
        <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 text-sm">{product.name}</h3>
        {product.ratings && product.ratings.count > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-600">{product.ratings.average.toFixed(1)} ({product.ratings.count})</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="font-bold text-gray-900">${product.price.toFixed(2)}</span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="text-xs text-gray-400 line-through ml-2">${product.comparePrice.toFixed(2)}</span>
            )}
          </div>
          <button onClick={handleAddToCart} disabled={product.inventory === 0}
            className="p-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}