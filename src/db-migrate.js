import mysql from 'mysql2/promise';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escapeMysqlIdentifier, mysqlConfigFromEnv, mysqlServerConfigFromEnv } from './mysql-config.js';

const currentFile = fileURLToPath(import.meta.url);
const defaultMigrationsDir = resolve(dirname(currentFile), '..', 'migrations');

export async function runMigrations({ config = mysqlConfigFromEnv(), migrationsDir = defaultMigrationsDir, log = console.log } = {}) {
  const databaseName = config.database;
  const serverConnection = await mysql.createConnection(mysqlServerConfigFromEnv(config));

  try {
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeMysqlIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await serverConnection.end();
  }

  const connection = await mysql.createConnection(config);

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(191) NOT NULL PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
    const applied = [];

    for (const file of files) {
      const [rows] = await connection.execute('SELECT id FROM schema_migrations WHERE id = ? LIMIT 1', [file]);
      if (rows.length) {
        log?.(`migration ${file} already applied`);
        continue;
      }

      const sql = await readFile(resolve(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.execute('INSERT INTO schema_migrations (id) VALUES (?)', [file]);
      applied.push(file);
      log?.(`migration ${file} applied`);
    }

    if (!applied.length) log?.('database schema is already up to date');
    return applied;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runMigrations().catch((error) => {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  });
}
