import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#080a0f',
        foreground: '#f9fafb',
        card: '#0e1117',
        'card-raised': '#151b27',
        border: '#1f2937',
        'border-subtle': '#111827',
        primary: '#2563eb',
        secondary: '#6b7280',
        warning: '#f59e0b',
        danger: '#ef4444',
        anomaly: '#f59e0b',
        success: '#10b981',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
