'use client';

import Link from 'next/link';
import { ShoppingCart, User, LogOut, Package } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useCartStore } from '@/lib/store/cart.store';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { cart, fetchCart } = useCartStore();

  useEffect(() => { if (isAuthenticated) fetchCart(); }, [isAuthenticated]);

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  async function handleLogout() { await logout(); toast.success('Logged out'); }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-700 tracking-tight">
          Nexcart
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link href="/orders" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
                <Package className="w-4 h-4" /> Orders
              </Link>
              <Link href="/cart" className="relative text-gray-600 hover:text-gray-900">
                <ShoppingCart className="w-6 h-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-700 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
                <User className="w-4 h-4" /> {user?.email.split('@')[0]}
              </Link>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Login</Link>
              <Link href="/register" className="btn-primary text-sm">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}