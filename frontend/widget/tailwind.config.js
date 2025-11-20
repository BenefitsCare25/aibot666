/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Refined minimal red/pink palette for professional look
        primary: {
          50: '#fef2f3',   // Lightest tint for backgrounds
          100: '#fde6e8',  // Very light for hover states
          200: '#fbd5d9',  // Light for borders and accents
          300: '#f8abb3',  // Medium light for inactive states
          400: '#f27a87',  // Medium for interactive elements
          500: '#e74c5e',  // Main brand color (refined from red-500)
          600: '#d6304a',  // Deeper for primary buttons
          700: '#b5233d',  // Dark for text on light backgrounds
          800: '#952039',  // Darker for emphasis
          900: '#7e1f36',  // Darkest for strong contrast
        },
        // Complementary rose palette for gradients
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',  // Vibrant rose accent
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        // Neutral grays optimized for WCAG AA
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',  // Meets 4.5:1 on white
          600: '#525252',  // Meets 7:1 on white
          700: '#404040',  // High contrast
          800: '#262626',
          900: '#171717',
        }
      },
      backgroundImage: {
        // Red gradients matching design requirements
        'gradient-primary': 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
        'gradient-primary-subtle': 'linear-gradient(135deg, #ef4444 0%, #f87171 50%, #fca5a5 100%)',
        'gradient-rose': 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
        'gradient-neutral': 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(231, 76, 94, 0.08)',
        'soft-md': '0 4px 16px rgba(231, 76, 94, 0.12)',
        'soft-lg': '0 8px 24px rgba(231, 76, 94, 0.16)',
        'glow': '0 0 24px rgba(231, 76, 94, 0.2)',
        'glow-lg': '0 0 40px rgba(231, 76, 94, 0.25)',
      },
      animation: {
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s infinite',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' }
        }
      },
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [],
  // Important: Prefix all classes to avoid conflicts with host website
  prefix: 'ic-',
  // Use important to override host website styles
  important: '#insurance-chat-widget-root'
}
