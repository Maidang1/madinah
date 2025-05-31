import { createCookie } from '@remix-run/cloudflare';

export const userTheme = createCookie('user-theme', {
  maxAge: 60 * 60 * 24 * 365, // 1 year
  httpOnly: false, // 需要在客户端可访问来同步 localStorage
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
});  