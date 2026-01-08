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
  vite: {
    server: {
      allowedHosts: ['nontonin.site']
    }
  }
});