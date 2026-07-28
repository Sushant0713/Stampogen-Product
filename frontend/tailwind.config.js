/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#021A54',
          50: '#E8EBF3',
          100: '#C5CCE1',
          200: '#9EA9CC',
          300: '#7686B7',
          400: '#586BA7',
          500: '#021A54',
          600: '#02174B',
          700: '#01133F',
          800: '#010F34',
          900: '#010A24',
        },
        background: '#FFFFFF',
        foreground: '#000000',
        muted: {
          DEFAULT: '#F5F6F8',
          foreground: '#6B7280',
        },
        border: '#E5E7EB',
        danger: '#DC2626',
        success: '#16A34A',
        warning: '#D97706',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sidebar: '1px 0 0 0 #E5E7EB',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
      },
      spacing: {
        sidebar: '260px',
        'sidebar-collapsed': '72px',
        navbar: '64px',
      },
    },
  },
  plugins: [],
};
