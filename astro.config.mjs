import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://pws-wobbuffet.github.io',
  base: '/peerdraw',
  integrations: [react()],
  output: 'static',
});
