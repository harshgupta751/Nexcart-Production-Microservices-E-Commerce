'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try { await register(form.email, form.password, form.name); toast.success('Account created! Welcome to Nexcart'); router.push('/'); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Registration failed'); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create account</h1>
        <p className="text-gray-500 mb-6 text-sm">Join Nexcart today</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(['name', 'email', 'password'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                className="input" value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                required minLength={field === 'password' ? 8 : undefined}
                placeholder={field === 'name' ? 'John Doe' : field === 'email' ? 'you@example.com' : '••••••••'}
              />
            </div>
          ))}
          <p className="text-xs text-gray-400">Password must be 8+ chars with uppercase, lowercase, and number</p>
          <button type="submit" disabled={isLoading} className="btn-primary w-full">{isLoading ? 'Creating account...' : 'Create Account'}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-700 hover:underline font-medium">Login</Link>
        </p>
      </div>
    </div>
  );
}