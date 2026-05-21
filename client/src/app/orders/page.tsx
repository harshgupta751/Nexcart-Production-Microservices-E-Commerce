'use client';

import { useQuery } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import { Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  CONFIRMED:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  PROCESSING: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: Package },
  SHIPPED:    { label: 'Shipped',    color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  DELIVERED:  { label: 'Delivered',  color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  CANCELLED:  { label: 'Cancelled',  color: 'bg-red-100 text-red-700',      icon: XCircle },
  REFUNDED:   { label: 'Refunded',   color: 'bg-gray-100 text-gray-700',    icon: XCircle },
};

export default function OrdersPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: () => orderApi.getOrders({ limit: 20 }) });
  const orders = data?.data?.data || [];

  if (isLoading) return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-gray-500">Loading orders...</div>;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-red-500">Failed to load orders</div>;
  if (orders.length === 0) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-700 mb-2">No orders yet</h2>
      <Link href="/" className="btn-primary inline-block mt-2">Start Shopping</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order: any) => {
          const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
          const Icon = cfg.icon;
          return (
            <div key={order.id} className="card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-500">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                  <Icon className="w-3 h-3" />{cfg.label}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="font-bold text-gray-900">Total: ${Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}