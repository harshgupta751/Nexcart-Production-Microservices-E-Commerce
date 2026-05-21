'use client';

import { useCartStore } from '@/lib/store/cart.store';
import { useAuthStore } from '@/lib/store/auth.store';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { cart, updateItem, removeItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  if (!isAuthenticated) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-700 mb-2">Please log in</h2>
      <Link href="/login" className="btn-primary inline-block mt-2">Login</Link>
    </div>
  );

  if (!cart || cart.items.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-700 mb-2">Your cart is empty</h2>
      <Link href="/" className="btn-primary inline-block mt-2">Browse Products</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart ({cart.items.length} items)</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <div key={item.productId} className="card p-4 flex gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                <Image src={item.image || '/placeholder.png'} alt={item.name} fill className="object-cover" unoptimized />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{item.name}</h3>
                <p className="text-blue-700 font-medium">${item.price.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => updateItem(item.productId, item.quantity - 1)} className="p-1 rounded border hover:bg-gray-100" disabled={isLoading}><Minus className="w-3 h-3" /></button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateItem(item.productId, item.quantity + 1)} className="p-1 rounded border hover:bg-gray-100" disabled={isLoading}><Plus className="w-3 h-3" /></button>
                  <button onClick={async () => { await removeItem(item.productId); toast.success('Removed'); }} className="ml-auto text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="card p-6 h-fit">
          <h2 className="font-bold text-lg text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <div className="flex justify-between"><span>Subtotal</span><span>${cart.total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax (8%)</span><span>${(cart.total * 0.08).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{cart.total >= 50 ? 'Free' : '$5.99'}</span></div>
            <hr />
            <div className="flex justify-between font-bold text-gray-900 text-base">
              <span>Total</span>
              <span>${(cart.total + cart.total * 0.08 + (cart.total >= 50 ? 0 : 5.99)).toFixed(2)}</span>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={() => router.push('/checkout')}>Proceed to Checkout</button>
          <Link href="/" className="block text-center text-sm text-gray-500 mt-3 hover:underline">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}