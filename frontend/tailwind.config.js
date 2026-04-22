/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xs': '375px',
      },
      spacing: {
        'safe-t': 'var(--sat)',
        'safe-b': 'var(--sab)',
        'safe-l': 'var(--sal)',
        'safe-r': 'var(--sar)',
      },
    },
  },
  plugins: [],
};
