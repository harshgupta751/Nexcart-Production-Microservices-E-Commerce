import nodemailer from 'nodemailer';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('Notification-Service:Email');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const FROM = process.env.EMAIL_FROM || 'noreply@nexcart.io';

export interface EmailOptions { to: string; subject: string; html: string; }

export async function sendEmail(opts: EmailOptions): Promise<void> {
  try {
    const info = await transporter.sendMail({ from: FROM, ...opts });
    logger.info('Email sent', { messageId: info.messageId, to: opts.to });
  } catch (err) {
    logger.error('Email send failed', err as Error, { to: opts.to });
    throw err;
  }
}

export function orderPlacedTemplate(data: { orderId: string; total: number; itemCount: number; userEmail: string }): EmailOptions {
  return {
    to: data.userEmail,
    subject: `🛒 Order Received — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1d4ed8;">We received your order!</h1>
        <p>Thank you for shopping with Nexcart. Your order is being processed.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Order ID:</strong> #${data.orderId.slice(0, 8).toUpperCase()}</p>
          <p><strong>Items:</strong> ${data.itemCount}</p>
          <p><strong>Total:</strong> $${data.total.toFixed(2)}</p>
        </div>
        <p>You will receive a payment confirmation shortly.</p>
        <p style="color: #6b7280; font-size: 12px;">Nexcart — Next-generation commerce platform</p>
      </div>
    `,
  };
}

export function orderConfirmedTemplate(data: { orderId: string; total: number; userEmail: string }): EmailOptions {
  return {
    to: data.userEmail,
    subject: `✅ Order Confirmed — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1d4ed8;">Order Confirmed!</h1>
        <p>Your payment was received and order has been confirmed.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 16px 0;">
          <p><strong>Order ID:</strong> #${data.orderId.slice(0, 8).toUpperCase()}</p>
          <p><strong>Total Paid:</strong> $${data.total.toFixed(2)}</p>
        </div>
        <p>We will notify you when your order ships.</p>
      </div>
    `,
  };
}

export function paymentFailedTemplate(data: { orderId: string; reason: string; userEmail: string }): EmailOptions {
  return {
    to: data.userEmail,
    subject: `❌ Payment Failed — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Payment Failed</h1>
        <p>Unfortunately your payment could not be processed.</p>
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 16px 0;">
          <p><strong>Order ID:</strong> #${data.orderId.slice(0, 8).toUpperCase()}</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>Please try again with a different payment method.</p>
      </div>
    `,
  };
}

export function welcomeTemplate(data: { name: string; email: string }): EmailOptions {
  return {
    to: data.email,
    subject: '👋 Welcome to Nexcart!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1d4ed8;">Welcome, ${data.name}!</h1>
        <p>Your account has been created successfully on Nexcart.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}"
           style="background: #1d4ed8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
          Start Shopping
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Nexcart — Next-generation commerce platform</p>
      </div>
    `,
  };
}