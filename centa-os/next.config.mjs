import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
  async headers() {
    const prod = process.env.NODE_ENV === 'production';
    const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join('; ');
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'DENY' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
      ...(prod ? [{ key: 'Content-Security-Policy', value: csp }, { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
    ] }];
  },
  webpack(config) { config.resolve.alias['@'] = path.join(here, 'src'); return config; },
};
