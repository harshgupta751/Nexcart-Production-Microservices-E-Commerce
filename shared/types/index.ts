export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  VENDOR = 'vendor',
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  tags: string[];
  inventory: number;
  sku: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variantId?: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  total: number;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  shippingAddress: Address;
  paymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ApiError[];
  pagination?: Pagination;
}

export interface ApiError {
  field?: string;
  message: string;
  code?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export enum EventType {
  ORDER_PLACED = 'order.placed',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_CANCELLED = 'order.cancelled',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  USER_REGISTERED = 'user.registered',
  USER_PASSWORD_RESET = 'user.password_reset',
}

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  timestamp: Date;
  version: string;
}

export interface OrderPlacedEvent extends BaseEvent {
  eventType: EventType.ORDER_PLACED;
  payload: {
    orderId: string;
    userId: string;
    userEmail: string;
    items: OrderItem[];
    total: number;
    shippingAddress: Address;
  };
}

export interface PaymentSuccessEvent extends BaseEvent {
  eventType: EventType.PAYMENT_SUCCESS;
  payload: {
    orderId: string;
    userId: string;
    userEmail: string;
    amount: number;
    paymentId: string;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_FAILED;
  payload: {
    orderId: string;
    userId: string;
    userEmail: string;
    reason: string;
  };
}

export interface UserRegisteredEvent extends BaseEvent {
  eventType: EventType.USER_REGISTERED;
  payload: {
    userId: string;
    email: string;
    name: string;
  };
}

export type DomainEvent =
  | OrderPlacedEvent
  | PaymentSuccessEvent
  | PaymentFailedEvent
  | UserRegisteredEvent;