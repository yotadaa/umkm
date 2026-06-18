import { MysqlStore } from './mysql-store.js';
import { Store } from './store.js';

export function createAppStore() {
  const driver = String(process.env.STORE_DRIVER || 'mysql').toLowerCase();

  if (driver === 'json' || driver === 'file') {
    return new Store(new URL('../data/db.json', import.meta.url));
  }

  return new MysqlStore();
}
