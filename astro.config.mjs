// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://nontonin.site',
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [tailwind()],
  build: {
    inlineStylesheets: 'always'
  },
  devToolbar: {
    enabled: false
  },
  vite: {
    server: {
      allowedHosts: ['nontonin.site'],
      hmr: {
        host: 'nontonin.site',
        protocol: 'wss'
      }
    },
    build: {
      assetsInlineLimit: 102400, // Inline assets under 100kb
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  }
});