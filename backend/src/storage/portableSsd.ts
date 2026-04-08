import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { config } from '../config';
import { CreateOrderRequest } from '../types';

export const isPortableSsdConfigured = (): boolean => Boolean(config.portableSsd.rootPath);

export const saveOrderSnapshotToPortableSsd = async (
  order: CreateOrderRequest,
): Promise<string | null> => {
  if (!isPortableSsdConfigured()) {
    return null;
  }

  const snapshotRoot = path.resolve(
    config.portableSsd.rootPath,
    config.portableSsd.snapshotDirectory,
  );

  await mkdir(snapshotRoot, { recursive: true });

  const snapshotPath = path.join(snapshotRoot, `${order.orderId}.json`);
  await writeFile(snapshotPath, JSON.stringify(order, null, 2), 'utf8');

  return snapshotPath;
};
