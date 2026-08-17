/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oracle: {
          red: '#C74634',
          darkRed: '#A5382A',
          light: '#FDECEA',
        },
        navy: {
          DEFAULT: '#1a2b4a',
          light: '#243860',
          pale: '#eef2f8',
        },
        brand: {
          blue: '#1d6fa4',
          light: '#3b8fd4',
          pale: '#e8f4fc',
          muted: '#daeef9',
        },
        accent: {
          cyan: '#00b4d8',
          teal: '#0077b6',
          glow: '#caf0f8',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 20px rgba(29,111,164,0.08)',
        'card-hover': '0 8px 40px rgba(29,111,164,0.16)',
        'btn': '0 4px 16px rgba(29,111,164,0.3)',
        'btn-hover': '0 8px 28px rgba(29,111,164,0.45)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'draw-line': 'drawLine 2s ease-in-out forwards',
        'fade-up': 'fadeUp 0.7s ease-out forwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'spin-slow': 'spin 3s linear infinite',
        'progress-indeterminate': 'progressIndeterminate 1.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        drawLine: {
          from: { strokeDashoffset: '200' },
          to: { strokeDashoffset: '0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.6)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        progressIndeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
    },
  },
  plugins: [],
}
