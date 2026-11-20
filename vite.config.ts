import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let base = env.VITE_BASE_PATH || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // 'prompt'：有新版本時提示使用者更新，避免在作答中途強制重新載入
        registerType: 'prompt',
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'JLPT Study｜日本語能力試験 練習',
          short_name: 'JLPT Study',
          description: 'N5・N4 文字語彙、文法、讀解練習與模擬考',
          lang: 'zh-Hant',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#FAF6EE',
          theme_color: '#C9402B',
          categories: ['education'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          navigateFallback: `${base}index.html`,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
      }),
    ],
    build: { chunkSizeWarningLimit: 900 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
