/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        midnight: '#0f172a',
        ocean: '#0ea5e9',
        cloud: '#f8fafc',
      },
      boxShadow: {
        glass: '0 20px 45px -20px rgba(15, 23, 42, 0.45)',
      },
      backgroundImage: {
        'gradient-soft':
          'radial-gradient(circle at top left, rgba(14, 165, 233, 0.22), transparent 55%), radial-gradient(circle at bottom right, rgba(129, 140, 248, 0.18), transparent 45%)',
      },
    },
  },
  plugins: [],
};
