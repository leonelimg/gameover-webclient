import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  // JWT
  jwtSecret: process.env['JWT_SECRET'] ?? 'change-me-in-production-please-use-a-long-secret',
  jwtAccessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] ?? 'change-refresh-secret-in-production',
  jwtRefreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '7d',

  // CORS
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',

  // Print Bridge installer artifacts
  printBridgeInstallerDir:
    process.env['PRINT_BRIDGE_INSTALLER_DIR']
    ?? path.resolve(process.cwd(), 'public', 'installers'),

  // Database
  get databaseUrl() {
    return required('DATABASE_URL');
  },
} as const;
