/**
 * WinSpoolerPrinter: sends raw ESC/POS bytes to a Windows printer queue
 * using the Win32 winspool API called from an inline PowerShell script.
 *
 * Use this when the USB printer driver does NOT expose a COM port or a
 * \\.\USB00x device path — i.e. it only appears in "Devices and Printers".
 *
 * Configuration:
 *   PRINTER_TRANSPORT=winspooler
 *   PRINTER_WINDOWS_NAME=<exact printer name from "Devices and Printers">
 *
 * The data type sent is "RAW" so Windows passes ESC/POS bytes unchanged.
 */

import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RAW_PRINT_SCRIPT = String.raw`
param([string]$PrinterName, [string]$DataFile)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int Level, ref DocInfo pDocInfo);

    [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBuf, int cbBuf, out int pcWritten);

    [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
}

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct DocInfo {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
}
"@

$bytes = [System.IO.File]::ReadAllBytes($DataFile)

$hPrinter = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) {
    throw "OpenPrinter failed for '$PrinterName'. Check the printer name in PRINTER_WINDOWS_NAME."
}

try {
    $docInfo = New-Object DocInfo
    $docInfo.pDocName  = "ESC/POS RAW"
    $docInfo.pDataType = "RAW"

    $docId = [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)
    if ($docId -le 0) { throw "StartDocPrinter failed" }

    try {
        if (-not [RawPrinterHelper]::StartPagePrinter($hPrinter)) { throw "StartPagePrinter failed" }

        $written = 0
        if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $bytes, $bytes.Length, [ref]$written)) {
            throw "WritePrinter failed (wrote $written of $($bytes.Length) bytes)"
        }

        [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
    } finally {
        [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
    }
} finally {
    [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
}

Write-Host "OK: sent $($bytes.Length) bytes to '$PrinterName'"
`;

export class WinSpoolerPrinter {
  constructor(private readonly printerName: string) {}

  async printRaw(data: Buffer): Promise<void> {
    const tmpFile = join(tmpdir(), `pb_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
    const scriptFile = join(tmpdir(), `pb_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);

    try {
      await writeFile(tmpFile, data);
      await writeFile(scriptFile, RAW_PRINT_SCRIPT, "utf8");

      const { stdout, stderr } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy", "Bypass",
          "-File", scriptFile,
          "-PrinterName", this.printerName,
          "-DataFile", tmpFile
        ],
        { windowsHide: true, timeout: 20_000 }
      );

      if (stderr && stderr.trim()) {
        throw new Error(`WinSpoolerPrinter error: ${stderr.trim()}`);
      }

      if (!stdout.includes("OK:")) {
        throw new Error(`WinSpoolerPrinter unexpected output: ${stdout}`);
      }
    } finally {
      await unlink(tmpFile).catch(() => {
        // ignore cleanup errors
      });
      await unlink(scriptFile).catch(() => {
        // ignore cleanup errors
      });
    }
  }
}
