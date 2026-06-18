export function mysqlConfigFromEnv(overrides = {}) {
  const database = overrides.database ?? process.env.DB_NAME ?? process.env.MYSQL_DATABASE ?? 'umkm_ai';

  return {
    host: overrides.host ?? process.env.DB_HOST ?? process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(overrides.port ?? process.env.DB_PORT ?? process.env.MYSQL_PORT ?? 3306),
    user: overrides.user ?? process.env.DB_USER ?? process.env.MYSQL_USER ?? 'root',
    password: overrides.password ?? process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? 'password',
    database,
    charset: 'utf8mb4',
    multipleStatements: true
  };
}

export function mysqlServerConfigFromEnv(overrides = {}) {
  const { database, ...config } = mysqlConfigFromEnv(overrides);
  return config;
}

export function escapeMysqlIdentifier(value) {
  const identifier = String(value || '');
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid MySQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}
