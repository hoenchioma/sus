import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Sus',
        short_name: 'Sus',
        description: 'A helper for Mafia, Werewolf and other social deduction games.',
        theme_color: '#0b1026',
        background_color: '#0b1026',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
});
