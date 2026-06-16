import { v4 as uuidv4 } from "uuid";
import { buildSimpleTextPrint, buildTicketPrint } from "./escpos.js";
import { config } from "./config.js";
import { PrinterTransport } from "./printers/index.js";
import { QueueStorage } from "./storage.js";
import { JobResult, PrintJob, TicketPayload } from "./types.js";

const nowIso = () => new Date().toISOString();

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const calcRetryDelayMs = (attempt: number, baseMs: number) => {
  const max = 60_000;
  return Math.min(baseMs * 2 ** Math.max(0, attempt - 1), max);
};

export class PrintQueueService {
  private readonly storage = new QueueStorage();
  private workerHandle?: NodeJS.Timeout;
  private processing = false;

  constructor(private readonly printer: PrinterTransport) {}

  async start() {
    await this.storage.ensure();
    await this.recoverStuckJobs();

    this.workerHandle = setInterval(() => {
      void this.processNext();
    }, config.queue.workerIntervalMs);
  }

  stop() {
    if (this.workerHandle) {
      clearInterval(this.workerHandle);
      this.workerHandle = undefined;
    }
  }

  async enqueueText(text: string): Promise<PrintJob> {
    return this.enqueue("text", { text });
  }

  async enqueueTicket(ticket: TicketPayload): Promise<PrintJob> {
    return this.enqueue("ticket", { ticket });
  }

  async getJob(id: string): Promise<PrintJob | undefined> {
    const state = await this.storage.read();
    return state.jobs.find((job) => job.id === id);
  }

  async getJobs(limit = 50): Promise<PrintJob[]> {
    const state = await this.storage.read();
    return state.jobs
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  async getStats() {
    const state = await this.storage.read();
    const stats = {
      pending: 0,
      processing: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
      total: state.jobs.length
    };

    for (const job of state.jobs) {
      stats[job.status] += 1;
    }

    return stats;
  }

  async retryJob(id: string): Promise<JobResult | undefined> {
    const state = await this.storage.read();
    const job = state.jobs.find((candidate) => candidate.id === id);
    if (!job) {
      return undefined;
    }

    job.status = "pending";
    job.nextAttemptAt = nowIso();
    job.updatedAt = nowIso();
    job.lastError = undefined;

    await this.storage.write(state);

    return {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError
    };
  }

  private async enqueue(
    type: PrintJob["type"],
    payload: PrintJob["payload"]
  ): Promise<PrintJob> {
    const now = nowIso();
    const job: PrintJob = {
      id: uuidv4(),
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: config.queue.maxAttempts,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now
    };

    const state = await this.storage.read();
    state.jobs.push(job);
    await this.storage.write(state);
    return job;
  }

  private async processNext() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const state = await this.storage.read();
      const now = Date.now();

      const next = state.jobs.find((job) => {
        if (job.status !== "pending" && job.status !== "retrying") {
          return false;
        }
        return new Date(job.nextAttemptAt).getTime() <= now;
      });

      if (!next) {
        return;
      }

      next.status = "processing";
      next.updatedAt = nowIso();
      await this.storage.write(state);

      try {
        if (next.type === "text") {
          const text = next.payload.text ?? "";
          await withTimeout(
            this.printer.printRaw(buildSimpleTextPrint(text)),
            config.printer.printTimeoutMs,
            "Text print"
          );
        } else {
          const ticket = next.payload.ticket;
          if (!ticket) {
            throw new Error("Ticket payload missing");
          }
          const effectiveColumns = ticket.width === 58 ? 32 : ticket.width === 80 ? 48 : config.printer.columns;
          await withTimeout(
            this.printer.printRaw(buildTicketPrint(ticket, effectiveColumns)),
            config.printer.printTimeoutMs,
            "Ticket print"
          );
        }

        next.status = "completed";
        next.finishedAt = nowIso();
        next.updatedAt = nowIso();
        next.lastError = undefined;
      } catch (error) {
        next.attempts += 1;
        next.updatedAt = nowIso();
        next.lastError = error instanceof Error ? error.message : "Unknown print error";

        if (next.attempts >= next.maxAttempts) {
          next.status = "failed";
          next.finishedAt = nowIso();
        } else {
          next.status = "retrying";
          const retryDelayMs = calcRetryDelayMs(next.attempts, config.queue.retryBaseMs);
          next.nextAttemptAt = new Date(Date.now() + retryDelayMs).toISOString();
        }
      }

      await this.storage.write(state);
    } finally {
      this.processing = false;
    }
  }

  private async recoverStuckJobs() {
    const state = await this.storage.read();
    const now = nowIso();
    let changed = false;

    for (const job of state.jobs) {
      if (job.status === "processing") {
        job.status = "retrying";
        job.nextAttemptAt = now;
        job.updatedAt = now;
        job.lastError = "Recovered from previous interrupted processing";
        changed = true;
      }
    }

    if (changed) {
      await this.storage.write(state);
    }
  }
}
