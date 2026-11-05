import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { DEFAULT: '#E57E9B', dark: '#c9607f', light: '#fbe9ef' }, ink: '#2b2d31' } } },
  plugins: [],
} satisfies Config;
