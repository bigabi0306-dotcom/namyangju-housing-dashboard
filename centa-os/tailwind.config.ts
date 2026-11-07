import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#E57E9B', dark: '#c9607f', light: '#fbe9ef', btn: '#c0486f', ink: '#b23a62' }  /* DEFAULT=장식, btn=버튼 배경(흰 글씨 4.8:1), ink=분홍 글씨(흰 배경 5.7:1) */, ink: '#1f2937',
        // 보조 글씨가 흐려 보이지 않도록 회색을 한 단계씩 진하게 (흰 배경 대비 4.8:1 이상)
        gray: { 400: '#6b7280', 500: '#4b5563', 600: '#374151' },
      },
      fontSize: { xs: ['0.8rem', { lineHeight: '1.3rem' }], sm: ['0.925rem', { lineHeight: '1.45rem' }] },
    },
  },
  plugins: [],
} satisfies Config;
