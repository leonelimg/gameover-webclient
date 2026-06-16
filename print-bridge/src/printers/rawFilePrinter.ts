/**
 * RawFilePrinter: writes ESC/POS bytes directly to a device path using
 * Node.js fs — no serialport dependency.
 *
 * Supports:
 *  - Windows USB printer ports : \\.\USB001, \\.\USB002, etc.
 *  - Windows COM ports         : \\.\COM5  (or just COM5)
 *  - Windows LPT ports         : \\.\LPT1
 *  - Linux USB direct          : /dev/usb/lp0
 *
 * For USB printers whose driver does NOT create a virtual COM port, use
 * PRINTER_TRANSPORT=rawfile and PRINTER_RAW_PATH=\\.\USB001
 * (adjust the number to match your device — run the /printers endpoint
 *  to see available ports, or check Device Manager → USB controllers).
 */

import fs from "node:fs";
import { promisify } from "node:util";

const fsOpen = promisify(fs.open);
const fsWrite = promisify(fs.write);
const fsClose = promisify(fs.close);

const normalizeDevicePath = (input: string): string => {
  const trimmed = input.trim();

  if (process.platform !== "win32") {
    // Keep POSIX device paths as-is except accidental trailing slash.
    return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
  }

  const withBackslashes = trimmed.replace(/\//g, "\\");
  const withoutTrailing = withBackslashes.replace(/\\+$/, "");

  // Accept USB005/COM5/LPT1 shorthand from UI and convert to Win32 device path.
  if (/^USB\d+$/i.test(withoutTrailing) || /^COM\d+$/i.test(withoutTrailing) || /^LPT\d+$/i.test(withoutTrailing)) {
    return `\\\\.\\${withoutTrailing.toUpperCase()}`;
  }

  return withoutTrailing;
};

export class RawFilePrinter {
  constructor(private readonly devicePath: string) {}

  async printRaw(data: Buffer): Promise<void> {
    const resolvedPath = normalizeDevicePath(this.devicePath);

    // O_WRONLY | O_SYNC — open for writing, no buffering so data reaches the device.
    // 0x400 = O_SYNC on Linux; on Windows fs.constants.O_WRONLY is sufficient.
    const flags = fs.constants.O_WRONLY;

    let fd: number;
    try {
      fd = await fsOpen(resolvedPath, flags);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `RawFilePrinter: cannot open device "${resolvedPath}" — ${msg}.\n` +
          `  • Verify the path in PRINTER_RAW_PATH.\n` +
          `  • On Windows, USB printer ports are usually \\\\.\\USB001, \\\\.\\USB002, …\n` +
          `    Try script: scripts/diagnose-usb-printer.ps1\n` +
          `  • If the driver registers the printer in "Devices and Printers" only,\n` +
          `    use PRINTER_TRANSPORT=winspooler and PRINTER_WINDOWS_NAME=<printer name>.`
      );
    }

    try {
      await fsWrite(fd, data, 0, data.length, null);
    } finally {
      await fsClose(fd).catch(() => {
        // ignore close errors
      });
    }
  }
}
