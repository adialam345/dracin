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
      hmr: {
        // Fix for WebSocket connection error when using Cloudflare Tunnel (https://... -> localhost:4321)
        // This tells the browser client to connect via port 443 (HTTPS default) instead of looking for 4321
        clientPort: 443,
      },
      // Allow the tunnel hostname
      allowedHosts: ['dracin.antarixa.qzz.io', 'qzz.io', '.qzz.io', 'localhost']
    }
  }
});
