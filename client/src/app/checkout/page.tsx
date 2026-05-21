'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store/cart.store';
import { useAuthStore } from '@/lib/store/auth.store';
import { orderApi, paymentApi } from '@/lib/api';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Address { street: string; city: string; state: string; country: string; zipCode: string; }

function CheckoutForm({ clientSecret, orderId }: { clientSecret: string; orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/orders?success=true` },
        redirect: 'if_required',
      });
      if (error) { toast.error(error.message || 'Payment failed'); }
      else if (paymentIntent?.status === 'succeeded') { toast.success('Payment successful! Order confirmed.'); router.push('/orders?success=true'); }
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button type="submit" disabled={!stripe || loading} className="btn-primary w-full mt-4">
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const { cart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState<'address' | 'payment'>('address');
  const [address, setAddress] = useState<Address>({ street: '', city: '', state: '', country: 'US', zipCode: '' });
  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) { router.push('/login'); return null; }
  if (!cart || cart.items.length === 0) { router.push('/cart'); return null; }

  const subtotal = cart.total;
  const tax = subtotal * 0.08;
  const shipping = subtotal >= 50 ? 0 : 5.99;
  const total = subtotal + tax + shipping;

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const orderRes = await orderApi.createOrder({
        items: cart!.items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, image: i.image })),
        shippingAddress: address,
      });
      const order = orderRes.data.data;
      setOrderId(order.id);
      const paymentRes = await paymentApi.createIntent({ orderId: order.id, amount: total, currency: 'usd' });
      setClientSecret(paymentRes.data.data.clientSecret);
      setStep('payment');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create order');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>
      <div className="flex items-center gap-4 mb-8">
        {['address', 'payment'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s ? 'bg-blue-700 text-white' : i < ['address', 'payment'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{i + 1}</div>
            <span className="capitalize text-sm font-medium text-gray-600">{s}</span>
            {i < 1 && <div className="w-16 h-px bg-gray-300" />}
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          {step === 'address' && (
            <div className="card p-6">
              <h2 className="font-bold text-lg mb-4">Shipping Address</h2>
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input className="input" value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} required placeholder="123 Main Street" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input className="input" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} required placeholder="New York" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label><input className="input" value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} required placeholder="NY" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label><input className="input" value={address.zipCode} onChange={(e) => setAddress((a) => ({ ...a, zipCode: e.target.value }))} required placeholder="10001" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Country</label><input className="input" value={address.country} onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))} required placeholder="US" /></div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Processing...' : 'Continue to Payment'}</button>
              </form>
            </div>
          )}
          {step === 'payment' && clientSecret && (
            <div className="card p-6">
              <h2 className="font-bold text-lg mb-4">Payment Details</h2>
              <p className="text-sm text-gray-500 mb-4">Test card: 4242 4242 4242 4242 · Any future date · Any CVV</p>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm clientSecret={clientSecret} orderId={orderId} />
              </Elements>
            </div>
          )}
        </div>
        <div className="card p-6 h-fit">
          <h2 className="font-bold text-lg mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm text-gray-600">
                <span className="line-clamp-1">{item.name} ×{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <hr className="my-3" />
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax (8%)</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span></div>
            <hr />
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}