'use client';

import { useQuery } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import { useCartStore } from '@/lib/store/cart.store';
import { ShoppingCart, Star, Package, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ProductPage({ params }: { params: { id: string } }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem } = useCartStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', params.id],
    queryFn: () => productApi.getProduct(params.id),
  });

  const product = data?.data?.data;

  if (isLoading) return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="grid md:grid-cols-2 gap-10">
        <div className="bg-gray-200 rounded-2xl h-96" />
        <div className="space-y-4"><div className="h-8 bg-gray-200 rounded w-3/4" /><div className="h-6 bg-gray-200 rounded w-1/4" /></div>
      </div>
    </div>
  );

  if (error || !product) return (
    <div className="max-w-5xl mx-auto px-4 py-20 text-center text-red-500">
      Product not found. <Link href="/" className="text-blue-700 underline">Go back</Link>
    </div>
  );

  const images = product.images?.length > 0 ? product.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];

  async function handleAddToCart() {
    try {
      await addItem({ productId: product._id || product.id, name: product.name, price: product.price, quantity, image: images[0] });
      toast.success(`Added ${quantity}× to cart!`);
    } catch { toast.error('Failed to add to cart'); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="relative h-96 rounded-2xl overflow-hidden bg-gray-100 mb-3">
            <Image src={images[selectedImage]} alt={product.name} fill className="object-cover" unoptimized />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img: string, i: number) => (
                <button key={i} onClick={() => setSelectedImage(i)} className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 ${selectedImage === i ? 'border-blue-700' : 'border-transparent'}`}>
                  <Image src={img} alt="" fill className="object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="text-sm text-blue-700 font-medium uppercase tracking-wide">{product.category}</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-1 mb-3">{product.name}</h1>
          {product.ratings?.count > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(product.ratings.average) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">({product.ratings.count} reviews)</span>
            </div>
          )}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
            {product.comparePrice > product.price && <span className="text-lg text-gray-400 line-through">${product.comparePrice.toFixed(2)}</span>}
          </div>
          <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>
          <div className="flex items-center gap-2 text-sm mb-6">
            <Package className="w-4 h-4 text-gray-400" />
            <span className={product.inventory > 0 ? 'text-green-600' : 'text-red-500'}>
              {product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-gray-100 font-bold">−</button>
              <span className="px-4 py-2 font-medium">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(product.inventory, q + 1))} className="px-3 py-2 hover:bg-gray-100 font-bold">+</button>
            </div>
            <button onClick={handleAddToCart} disabled={product.inventory === 0} className="btn-primary flex items-center gap-2 flex-1 justify-center">
              <ShoppingCart className="w-4 h-4" /> Add to Cart
            </button>
          </div>
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {product.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}