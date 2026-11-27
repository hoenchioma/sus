import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import postcss, { type Plugin as PostcssPlugin } from 'postcss';
import cascadeLayers from '@csstools/postcss-cascade-layers';

/** `100dvh` with a `100vh` line in front, for browsers that don't know dynamic viewport units. */
const dvhFallback: PostcssPlugin = {
  postcssPlugin: 'dvh-fallback',
  Declaration(decl) {
    if (decl.value.includes('dvh')) decl.cloneBefore({ value: decl.value.replaceAll('dvh', 'vh') });
  },
};

/**
 * TV browsers (Android TV web views, older smart TVs) can be Chromium 90 or so, which ignores every rule
 * inside `@layer` — and Tailwind puts all of its CSS in layers. Flattening the layers in the shipped CSS
 * keeps the same cascade for modern browsers and lets older ones style the page at all.
 */
function legacyCss(): Plugin {
  return {
    name: 'sus-legacy-css',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const result = await postcss([cascadeLayers(), dvhFallback]).process(String(file.source), { from: undefined });
        file.source = result.css;
      }
    },
  };
}

export default defineConfig({
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  // Old enough for the web views on TVs, which update far more slowly than phones.
  build: { target: ['es2020', 'chrome87', 'safari14', 'firefox88'] },
  plugins: [
    react(),
    tailwindcss(),
    legacyCss(),
    VitePWA({
      registerType: 'autoUpdate',
      // The Android TV app download has to reach the server, not the offline copy of the web app.
      workbox: { navigateFallbackDenylist: [/^\/api\//, /\.apk$/] },
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
