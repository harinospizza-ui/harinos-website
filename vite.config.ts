import path from 'path';
import { Plugin, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const createNoCacheVersionPlugin = (buildVersion: string): Plugin => ({
  name: 'harinos-no-cache-version',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const requestPath = req.url?.split('?')[0] ?? '';

      if (
        requestPath === '/' ||
        requestPath.endsWith('.html') ||
        requestPath.endsWith('/manifest.json') ||
        requestPath.endsWith('/version.json') ||
        requestPath.endsWith('/sw.js')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      next();
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify(
        {
          version: buildVersion,
          generatedAt: buildVersion,
        },
        null,
        2,
      ),
    });
  },
});

export default defineConfig(() => {
  const buildVersion = new Date().toISOString();

  return {
    base: '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), createNoCacheVersionPlugin(buildVersion)],
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
