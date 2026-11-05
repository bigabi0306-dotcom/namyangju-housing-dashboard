import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  webpack(config) { config.resolve.alias['@'] = path.join(here, 'src'); return config; },
};
