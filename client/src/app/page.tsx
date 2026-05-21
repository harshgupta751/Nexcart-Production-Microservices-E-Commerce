'use client';

import { useQuery } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import { ProductCard } from '@/components/ui/ProductCard';
import { useState } from 'react';
import { Search } from 'lucide-react';

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Books', 'Home', 'Sports'];

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', { search, category, page }],
    queryFn: () => productApi.getProducts({ search: search || undefined, category: category || undefined, page, limit: 12 }),
  });

  const products = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-10 mb-10 text-white text-center">
        <h1 className="text-4xl font-bold mb-3">Nexcart</h1>
        <p className="text-blue-100 text-lg mb-6">Next-generation commerce — Microservices · API Gateway · Redis · RabbitMQ · AWS</p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            className="w-full pl-10 pr-4 py-3 rounded-xl text-gray-800 focus:outline-none"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button key={cat}
            onClick={() => { setCategory(cat === 'All' ? '' : cat); setPage(1); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${(cat === 'All' && !category) || category === cat ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="bg-gray-200 h-48 w-full" />
              <div className="p-4 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-4 bg-gray-200 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">Failed to load products. Is the API Gateway running?</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No products found</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product: any) => <ProductCard key={product._id || product.id} product={product} />)}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-40">Previous</button>
          <span className="px-4 py-2 text-gray-600">Page {page} of {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="btn-secondary disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}