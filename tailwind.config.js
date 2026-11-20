/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF6EE',
        card: '#FFFDF8',
        sand: '#F1EADB',
        line: '#E6DECD',
        ink: { DEFAULT: '#2B2A28', soft: '#5A5750', faint: '#8B8678' },
        shu: { DEFAULT: '#C9402B', dark: '#A53220', soft: '#F8E3DC' },
        ok: { DEFAULT: '#4F8458', soft: '#E4EFE2' },
        ng: { DEFAULT: '#C2544A', soft: '#F8E2DE' },
      },
      fontFamily: {
        sans: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Noto Sans JP"', '"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', '"Yu Gothic"', 'system-ui', 'sans-serif'],
        serif: ['"Shippori Mincho"', '"Hiragino Mincho ProN"', '"Yu Mincho"', '"Noto Serif JP"', '"Noto Serif TC"', '"PMingLiU"', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(60,40,20,.04), 0 6px 20px -8px rgba(60,40,20,.12)',
        lift: '0 2px 4px rgba(60,40,20,.05), 0 14px 30px -12px rgba(60,40,20,.2)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
