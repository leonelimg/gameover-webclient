import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { getPrinterInfo, listPrinters, printerTransport } from "./printers/index.js";
import { PrintQueueService } from "./queue.js";
import {
  authHeaderSchema,
  testPrintSchema,
  textPrintSchema,
  ticketPrintSchema
} from "./schemas.js";

const app = express();
const queue = new PrintQueueService(printerTransport);

const isAllowedOrigin = (origin?: string) => {
  return !origin || origin === "null" || config.server.allowedOrigins.includes(origin);
};

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    next();
    return;
  }

  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin, Access-Control-Request-Private-Network");
  }

  if (req.headers["access-control-request-private-network"] === "true") {
    res.header("Access-Control-Allow-Private-Network", "true");
  }

  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204
  })
);

app.options("*", (req, res) => {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.headers["access-control-request-private-network"] === "true") {
    res.header("Access-Control-Allow-Private-Network", "true");
  }

  res.sendStatus(204);
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  if (!config.server.token) {
    next();
    return;
  }

  const parsed = authHeaderSchema.safeParse(req.headers);
  if (!parsed.success) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const auth = parsed.data.authorization;
  if (!auth || auth !== `Bearer ${config.server.token}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
});

app.get("/health", async (_req, res) => {
  const queueStats = await queue.getStats();
  res.json({
    ok: true,
    now: new Date().toISOString(),
    printer: getPrinterInfo(),
    queue: queueStats
  });
});

app.get("/printers", async (_req, res) => {
  const ports = await listPrinters();
  res.json({
    configured: getPrinterInfo(),
    available: ports
  });
});

app.post("/test-print", async (req, res) => {
  const parsed = testPrintSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const message = `${parsed.data.message}\n${new Date().toISOString()}`;
  const job = await queue.enqueueText(message);
  res.status(202).json({
    jobId: job.id,
    status: job.status
  });
});

app.post("/print-text", async (req, res) => {
  const parsed = textPrintSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const job = await queue.enqueueText(parsed.data.text);
  res.status(202).json({
    jobId: job.id,
    status: job.status
  });
});

app.post("/print-ticket", async (req, res) => {
  const parsed = ticketPrintSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const job = await queue.enqueueTicket(parsed.data.ticket);
  res.status(202).json({
    jobId: job.id,
    status: job.status
  });
});

app.get("/jobs", async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 250) : 50;
  const jobs = await queue.getJobs(limit);
  res.json({ jobs });
});

app.get("/jobs/:id", async (req, res) => {
  const job = await queue.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

app.post("/jobs/:id/retry", async (req, res) => {
  const result = await queue.retryJob(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(result);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  res.status(500).json({ error: message });
});

const start = async () => {
  await queue.start();

  app.listen(config.server.port, config.server.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      `Print Bridge running on http://${config.server.host}:${config.server.port} using ${config.printer.serialPort}`
    );
  });
};

void start();
