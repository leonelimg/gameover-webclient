import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { QueueState } from "./types.js";

const initialState: QueueState = {
  jobs: []
};

export class QueueStorage {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(config.storage.dataDir, config.storage.queueFileName);
  }

  async ensure(): Promise<void> {
    await fs.mkdir(config.storage.dataDir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(initialState, null, 2), "utf8");
    }
  }

  async read(): Promise<QueueState> {
    await this.ensure();
    const content = await fs.readFile(this.filePath, "utf8");
    try {
      const parsed = JSON.parse(content) as QueueState;
      if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
        return { jobs: [] };
      }
      return parsed;
    } catch (error) {
      console.error(`[storage] Failed to parse queue state JSON from ${this.filePath}:`, error);

      try {
        const backupPath = `${this.filePath}.corrupted`;
        await fs.writeFile(backupPath, content, "utf8");
        console.warn(`[storage] Backup of corrupted queue saved to ${backupPath}`);
      } catch (backupError) {
        console.error(`[storage] Failed to backup corrupted queue file:`, backupError);
      }

      await this.write(initialState);
      return { jobs: [] };
    }
  }

  async write(state: QueueState): Promise<void> {
    await this.ensure();
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }
}
