import path from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Plugin, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

interface SharedOrderRecord {
  id: string;
  outletId?: string;
  status?: string;
  statusHistory?: Array<{ status: string; timestamp: string; changedBy: string }>;
  [key: string]: unknown;
}

const sharedOrderStorePath = path.resolve(__dirname, '.harinos-shared-orders', 'orders.json');

const readSharedOrders = (): SharedOrderRecord[] => {
  try {
    return JSON.parse(readFileSync(sharedOrderStorePath, 'utf8')) as SharedOrderRecord[];
  } catch {
    return [];
  }
};

const writeSharedOrders = (orders: SharedOrderRecord[]): void => {
  mkdirSync(path.dirname(sharedOrderStorePath), { recursive: true });
  writeFileSync(sharedOrderStorePath, JSON.stringify(orders, null, 2), 'utf8');
};

const createSharedOrderApiPlugin = (): Plugin => {
  const handleApiRequest = async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void,
  ) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (!url.pathname.startsWith('/api/orders')) {
      next();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');

    const sendJson = (statusCode: number, body: unknown) => {
      res.statusCode = statusCode;
      res.end(JSON.stringify(body));
    };

    const getBody = async <T,>(): Promise<T> => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
    };

    try {
      const orders = readSharedOrders();

      if (req.method === 'GET') {
        const outletId = url.searchParams.get('outletId');
        const filteredOrders = outletId ? orders.filter((order) => order.outletId === outletId) : orders;
        sendJson(200, { success: true, orders: filteredOrders });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/orders') {
        const order = await getBody<SharedOrderRecord>();
        if (!order.id) {
          sendJson(400, { success: false, message: 'Order id is required.' });
          return;
        }

        const withoutExisting = orders.filter((existingOrder) => existingOrder.id !== order.id);
        writeSharedOrders([order, ...withoutExisting]);
        sendJson(201, { success: true, order });
        return;
      }

      const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
      if (req.method === 'PATCH' && statusMatch) {
        const orderId = decodeURIComponent(statusMatch[1]);
        const payload = await getBody<{ outletId: string; status: string; changedBy: string }>();
        const timestamp = new Date().toISOString();
        const nextOrders = orders.map((order) => {
          if (order.id !== orderId) {
            return order;
          }

          return {
            ...order,
            status: payload.status,
            statusHistory: [
              ...(order.statusHistory ?? []),
              { status: payload.status, timestamp, changedBy: payload.changedBy },
            ],
          };
        });
        writeSharedOrders(nextOrders);
        sendJson(200, { success: true });
        return;
      }

      const deleteMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (req.method === 'DELETE' && deleteMatch) {
        const orderId = decodeURIComponent(deleteMatch[1]);
        writeSharedOrders(orders.filter((order) => order.id !== orderId));
        sendJson(200, { success: true });
        return;
      }

      sendJson(404, { success: false, message: 'Unknown order API route.' });
    } catch (error) {
      console.error('Shared order API failed:', error);
      sendJson(500, { success: false, message: 'Shared order API failed.' });
    }
  };

  return {
    name: 'harinos-shared-order-api',
    configureServer(server) {
      server.middlewares.use(handleApiRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApiRequest);
    },
  };
};

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
    plugins: [react(), createSharedOrderApiPlugin(), createNoCacheVersionPlugin(buildVersion)],
    build: {
      target: ['es2018', 'safari13'],
      cssTarget: 'safari13',
    },
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
