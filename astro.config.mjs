// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [tailwind()],
  devToolbar: {
    enabled: false
  },
  vite: {
    server: {
      // Allow the tunnel hostname
      allowedHosts: ['dracin.antarixa.qzz.io', 'qzz.io', '.qzz.io', 'localhost'],
      hmr: {
        // Disable HMR overlay and use default port handling
        overlay: false
      }
    }
  }
});
