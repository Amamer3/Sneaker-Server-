import { Resend } from 'resend';
import Logger from '../utils/logger';
import type { Order } from '../models/Order';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appBaseUrl(): string {
  const u = (process.env.FRONTEND_URL || process.env.EMAIL_APP_BASE_URL || '').trim();
  return u.replace(/\/$/, '');
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export function isEmailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

async function sendEmail(
  params: { to: string; subject: string; html: string; text: string },
  options: { required: boolean }
): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const client = getResend();
  if (!from || !client) {
    const msg = 'Resend is not configured (set RESEND_API_KEY and RESEND_FROM_EMAIL)';
    if (options.required) {
      throw new Error(msg);
    }
    Logger.warn(msg + '; email not sent');
    return;
  }

  const { data, error } = await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    ...(process.env.RESEND_REPLY_TO?.trim()
      ? { reply_to: process.env.RESEND_REPLY_TO.trim() }
      : {}),
  });

  if (error) {
    Logger.error(`Resend error: ${error.message}`);
    throw new Error(error.message);
  }

  Logger.info(`Transactional email sent to ${params.to}${data?.id ? ` (id ${data.id})` : ''}`);
}

export async function sendFirebasePasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const safeTo = escapeHtml(to);
  const subject = 'Reset your password';
  const text = `We received a request to reset your password. Open this link (valid for a limited time):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We received a request to reset the password for <strong>${safeTo}</strong>.</p>
  <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a></p>
  <p style="font-size:14px;color:#555;">If the button does not work, copy and paste this URL into your browser:</p>
  <p style="font-size:12px;word-break:break-all;color:#555;">${escapeHtml(resetLink)}</p>
  <p style="font-size:14px;color:#555;">If you did not request this, you can ignore this email.</p>
</body>
</html>`;
  await sendEmail({ to, subject, html, text }, { required: true });
}

export async function sendJwtPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const base = appBaseUrl();
  if (!base) {
    Logger.warn('FRONTEND_URL not set; cannot build password reset link for email');
    return;
  }
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const displayName = escapeHtml(name || 'there');
  const subject = 'Reset your password';
  const text = `Hi ${name || 'there'},\n\nReset your password using this link (expires in 1 hour):\n\n${link}\n\nIf you did not request this, ignore this email.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${displayName},</p>
  <p>You asked to reset your password. This link expires in <strong>1 hour</strong>.</p>
  <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a></p>
  <p style="font-size:12px;word-break:break-all;color:#555;">${escapeHtml(link)}</p>
</body>
</html>`;
  await sendEmail({ to, subject, html, text }, { required: false });
}

export async function sendEmailVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const base = appBaseUrl();
  if (!base) {
    Logger.warn('FRONTEND_URL not set; cannot build verification link for email');
    return;
  }
  const path = (process.env.EMAIL_VERIFICATION_PATH || '/verify-email').replace(/^\//, '');
  const link = `${base}/${path}?token=${encodeURIComponent(token)}`;
  const displayName = escapeHtml(name || 'there');
  const subject = 'Verify your email address';
  const text = `Hi ${name || 'there'},\n\nPlease verify your email by opening this link (expires in 24 hours):\n\n${link}\n\nIf you did not create an account, ignore this email.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${displayName},</p>
  <p>Thanks for signing up. Please confirm your email address — this link expires in <strong>24 hours</strong>.</p>
  <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Verify email</a></p>
  <p style="font-size:12px;word-break:break-all;color:#555;">${escapeHtml(link)}</p>
</body>
</html>`;
  await sendEmail({ to, subject, html, text }, { required: false });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const base = appBaseUrl();
  const displayName = escapeHtml(name || 'there');
  const subject = 'Welcome to Sneaker Store';
  const text = `Hi ${name || 'there'},\n\nThanks for joining Sneaker Store. Browse the latest drops and enjoy your member benefits.\n\n${base ? `Visit us: ${base}` : ''}`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${displayName},</p>
  <p>Thanks for joining <strong>Sneaker Store</strong>. Explore the latest collection and member benefits.</p>
  ${base ? `<p><a href="${base}">Go to store</a></p>` : ''}
</body>
</html>`;
  await sendEmail({ to, subject, html, text }, { required: false });
}

export async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  const to = order.user?.email || order.shipping?.email;
  if (!to) {
    Logger.warn('Order confirmation email skipped: no recipient email on order');
    return;
  }
  const name = escapeHtml(order.user?.name || order.shipping?.name || 'Customer');
  const num = escapeHtml(order.orderNumber);
  const total = order.total ?? order.totalAmount ?? 0;
  const currency = order.currency || 'USD';
  const lines = order.items
    .map(
      (i) =>
        `• ${escapeHtml(i.name)} × ${i.quantity} — ${currency} ${(i.price * i.quantity).toFixed(2)}`
    )
    .join('\n');
  const subject = `Order confirmed — ${order.orderNumber}`;
  const text = `Hi ${order.user?.name || order.shipping?.name || 'Customer'},\n\nThank you for your order ${order.orderNumber}.\n\n${lines}\n\nTotal: ${currency} ${total.toFixed(2)}\n\nWe'll send updates as your order progresses.`;
  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td><td style="padding:8px;border-bottom:1px solid #eee;">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${currency} ${(i.price * i.quantity).toFixed(2)}</td></tr>`
    )
    .join('');
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${name},</p>
  <p>Thank you for your order <strong>#${num}</strong>.</p>
  <table style="width:100%;max-width:480px;border-collapse:collapse;margin:16px 0;">
    <thead><tr><th align="left" style="padding:8px;border-bottom:2px solid #111;">Item</th><th style="padding:8px;border-bottom:2px solid #111;">Qty</th><th align="right" style="padding:8px;border-bottom:2px solid #111;">Subtotal</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <p><strong>Total: ${currency} ${total.toFixed(2)}</strong></p>
  <p style="color:#555;font-size:14px;">We'll notify you when your order status changes.</p>
</body>
</html>`;
  await sendEmail({ to, subject, html, text }, { required: false });
}

export async function sendOrderCancelledEmail(order: Order, reason?: string): Promise<void> {
  const to = order.user?.email || order.shipping?.email;
  if (!to) return;
  const name = escapeHtml(order.user?.name || order.shipping?.name || 'Customer');
  const num = escapeHtml(order.orderNumber);
  const subject = `Order cancelled — ${order.orderNumber}`;
  const reasonText = reason ? `\n\nReason: ${reason}` : '';
  const text = `Hi ${order.user?.name || order.shipping?.name || 'Customer'},\n\nYour order ${order.orderNumber} has been cancelled.${reasonText}`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${name},</p>
  <p>Your order <strong>#${num}</strong> has been cancelled.</p>
  ${reason ? `<p style="color:#555;">${escapeHtml(reason)}</p>` : ''}
</body>
</html>`;
  await sendEmail({ to, subject, html, text }, { required: false });
}
