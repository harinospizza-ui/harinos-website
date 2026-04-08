import 'dotenv/config';

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

export const config = {
  server: {
    port: toNumber(process.env.PORT, 4000),
  },
  mysql: {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: toNumber(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? 'harinos_orders',
  },
  portableSsd: {
    rootPath: process.env.PORTABLE_SSD_ROOT ?? '',
    snapshotDirectory: process.env.ORDER_SNAPSHOT_DIR ?? 'orders-cache',
  },
};
