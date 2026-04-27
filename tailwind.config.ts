import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
    },
    extend: {
      colors: {
        navy: '#1B3A5C',
        accent: '#2E7D9A',
        card: '#F5F7FA',
        'text-primary': '#1A1A2E',
        'text-secondary': '#6B7280',
        border: '#E2E8F0',
      },
    },
  },
  plugins: [],
}
export default config
