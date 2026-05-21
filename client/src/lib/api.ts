import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; name: string }) => apiClient.post('/auth/register', data),
  login: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
  refresh: (refreshToken: string) => apiClient.post('/auth/refresh', { refreshToken }),
};

export const productApi = {
  getProducts: (params?: { page?: number; limit?: number; category?: string; search?: string; minPrice?: number; maxPrice?: number }) =>
    apiClient.get('/products', { params }),
  getProduct: (id: string) => apiClient.get(`/products/${id}`),
  createProduct: (data: any) => apiClient.post('/products', data),
  updateProduct: (id: string, data: any) => apiClient.put(`/products/${id}`, data),
  deleteProduct: (id: string) => apiClient.delete(`/products/${id}`),
};

export const cartApi = {
  getCart: () => apiClient.get('/cart'),
  addItem: (data: { productId: string; name: string; price: number; quantity: number; image: string; variantId?: string }) =>
    apiClient.post('/cart/items', data),
  updateItem: (productId: string, quantity: number) => apiClient.put(`/cart/items/${productId}`, { quantity }),
  removeItem: (productId: string) => apiClient.delete(`/cart/items/${productId}`),
  clearCart: () => apiClient.delete('/cart'),
};

export const orderApi = {
  getOrders: (params?: { page?: number; limit?: number }) => apiClient.get('/orders', { params }),
  getOrder: (id: string) => apiClient.get(`/orders/${id}`),
  createOrder: (data: { items: any[]; shippingAddress: any }) => apiClient.post('/orders', data),
  cancelOrder: (id: string) => apiClient.patch(`/orders/${id}/cancel`),
};

export const paymentApi = {
  createIntent: (data: { orderId: string; amount: number; currency?: string }) => apiClient.post('/payments/intent', data),
  confirmPayment: (data: { paymentIntentId: string; paymentMethodId: string }) => apiClient.post('/payments/confirm', data),
  getPaymentByOrder: (orderId: string) => apiClient.get(`/payments/order/${orderId}`),
  refund: (paymentId: string) => apiClient.post(`/payments/${paymentId}/refund`),
  getCircuitStatus: () => apiClient.get('/payments/circuit-status'),
};

export const userApi = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data: any) => apiClient.put('/users/profile', data),
  addAddress: (data: any) => apiClient.post('/users/addresses', data),
  updateAddress: (id: string, data: any) => apiClient.put(`/users/addresses/${id}`, data),
  deleteAddress: (id: string) => apiClient.delete(`/users/addresses/${id}`),
};