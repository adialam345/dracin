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
  devToolbar: {
    enabled: false
  },
  build: {
    inlineStylesheets: 'auto',
    assets: '_astro'
  },
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
  vite: {
    build: {
      cssMinify: 'esbuild',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'video-lib': ['hls.js']
          }
        }
      }
    },
    server: {
      allowedHosts: ['nontonin.site']
    },
    ssr: {
      // Allow crypto-js to be handled as external dependency in SSR
    }
  }
});