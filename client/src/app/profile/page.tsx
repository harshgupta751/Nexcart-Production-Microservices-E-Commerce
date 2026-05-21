'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { useState } from 'react';
import { User, MapPin, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: 'Home', street: '', city: '', state: '', country: 'US', zipCode: '', isDefault: false });

  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => userApi.getProfile(), enabled: isAuthenticated });

  const addAddressMutation = useMutation({
    mutationFn: () => userApi.addAddress(newAddress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setAddingAddress(false);
      setNewAddress({ label: 'Home', street: '', city: '', state: '', country: 'US', zipCode: '', isDefault: false });
      toast.success('Address added');
    },
    onError: () => toast.error('Failed to add address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteAddress(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Address removed'); },
  });

  const profile = data?.data?.data;

  if (!isAuthenticated) return <div className="p-8 text-center text-gray-500">Please log in</div>;
  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-7 h-7 text-blue-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{profile?.name || user?.email}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">{user?.role}</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500" /> Saved Addresses</h2>
          <button onClick={() => setAddingAddress(!addingAddress)} className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {addingAddress && (
          <div className="border border-blue-200 rounded-xl p-4 mb-4 bg-blue-50">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[{ key: 'label', placeholder: 'Label (Home, Work)' }, { key: 'street', placeholder: 'Street address' }, { key: 'city', placeholder: 'City' }, { key: 'state', placeholder: 'State' }, { key: 'zipCode', placeholder: 'ZIP Code' }, { key: 'country', placeholder: 'Country' }].map(({ key, placeholder }) => (
                <input key={key} className="input text-sm" placeholder={placeholder} value={(newAddress as any)[key]}
                  onChange={(e) => setNewAddress((a) => ({ ...a, [key]: e.target.value }))} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => addAddressMutation.mutate()} className="btn-primary text-sm">Save Address</button>
              <button onClick={() => setAddingAddress(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {profile?.addresses?.length === 0 ? (
          <p className="text-gray-400 text-sm">No addresses saved yet.</p>
        ) : (
          <div className="space-y-3">
            {profile?.addresses?.map((addr: any) => (
              <div key={addr.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{addr.label}</span>
                    {addr.isDefault && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{addr.street}, {addr.city}, {addr.state} {addr.zipCode}, {addr.country}</p>
                </div>
                <button onClick={() => deleteAddressMutation.mutate(addr.id)} className="text-red-400 hover:text-red-600 ml-4 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}