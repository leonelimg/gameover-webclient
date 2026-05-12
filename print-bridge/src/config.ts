import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PRINTBRIDGE_PORT: z.coerce.number().int().positive().default(17890),
  PRINTBRIDGE_HOST: z.string().default("127.0.0.1"),
  PRINTBRIDGE_TOKEN: z.string().optional(),
  PRINTBRIDGE_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  PRINTBRIDGE_DATA_DIR: z.string().default("./data"),
  PRINTER_TRANSPORT: z.enum(["serial"]).default("serial"),
  PRINTER_SERIAL_PORT: z.string().default("COM5"),
  PRINTER_SERIAL_BAUD: z.coerce.number().int().positive().default(9600),
  PRINT_JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  PRINTER_COLUMNS: z.coerce.number().int().min(32).max(64).default(48),
  PRINTER_CHARSET: z.string().default("cp437"),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  QUEUE_RETRY_BASE_MS: z.coerce.number().int().min(500).default(2000),
  QUEUE_WORKER_INTERVAL_MS: z.coerce.number().int().min(250).default(2000)
});

const parsed = envSchema.parse(process.env);

const allowedOrigins = parsed.PRINTBRIDGE_ALLOWED_ORIGINS.split(",")
  .map((v) => v.trim())
  .filter(Boolean);

export const config = {
  server: {
    port: parsed.PRINTBRIDGE_PORT,
    host: parsed.PRINTBRIDGE_HOST,
    token: parsed.PRINTBRIDGE_TOKEN,
    allowedOrigins
  },
  storage: {
    dataDir: path.resolve(parsed.PRINTBRIDGE_DATA_DIR),
    queueFileName: "queue.json"
  },
  printer: {
    transport: parsed.PRINTER_TRANSPORT,
    serialPort: parsed.PRINTER_SERIAL_PORT,
    serialBaud: parsed.PRINTER_SERIAL_BAUD,
    printTimeoutMs: parsed.PRINT_JOB_TIMEOUT_MS,
    columns: parsed.PRINTER_COLUMNS,
    charset: parsed.PRINTER_CHARSET
  },
  queue: {
    maxAttempts: parsed.QUEUE_MAX_ATTEMPTS,
    retryBaseMs: parsed.QUEUE_RETRY_BASE_MS,
    workerIntervalMs: parsed.QUEUE_WORKER_INTERVAL_MS
  }
} as const;
