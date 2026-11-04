import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'],
        manifest: {
          name: 'Mando â€” Carreira de manager',
          short_name: 'Mando',
          description: 'Seu clube. Suas decisÃµes.',
          theme_color: '#0a1f5c',
          background_color: '#071447',
          display: 'standalone',
          orientation: 'landscape',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'data/*.json'],
          // Rostos dos atletas ficam fora do pré-cache e entram no cache conforme aparecem.
          globIgnores: ['**/assets/jogadores/**'],
          runtimeCaching: [
            {
              urlPattern: /\/assets\/jogadores\/.+\.webp$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'player-faces',
                expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/auth/, /\/functions\//],
        },
      }),
    ],
  };
});
