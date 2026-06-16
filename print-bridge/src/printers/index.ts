import { config } from "../config.js";
import { SerialPrinter } from "./serialPrinter.js";
import { RawFilePrinter } from "./rawFilePrinter.js";
import { WinSpoolerPrinter } from "./winSpoolerPrinter.js";

export interface PrinterTransport {
  printRaw(data: Buffer): Promise<void>;
}

function buildTransport(): PrinterTransport {
  switch (config.printer.transport) {
    case "rawfile":
      return new RawFilePrinter(config.printer.rawPath);
    case "winspooler":
      if (!config.printer.windowsName) {
        throw new Error(
          "PRINTER_WINDOWS_NAME is required when PRINTER_TRANSPORT=winspooler. " +
          "Set it to the exact printer name shown in Windows \"Devices and Printers\"."
        );
      }
      return new WinSpoolerPrinter(config.printer.windowsName);
    default:
      return new SerialPrinter(config.printer.serialPort, config.printer.serialBaud);
  }
}

export const printerTransport: PrinterTransport = buildTransport();

export const getPrinterInfo = () => ({
  transport: config.printer.transport,
  port: config.printer.transport === "rawfile"
    ? config.printer.rawPath
    : config.printer.transport === "winspooler"
    ? config.printer.windowsName
    : config.printer.serialPort,
  baudRate: config.printer.transport === "serial" ? config.printer.serialBaud : null
});

export const listPrinters = async () => {
  const ports = await SerialPrinter.listPorts();
  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer,
    serialNumber: port.serialNumber,
    pnpId: port.pnpId,
    vendorId: port.vendorId,
    productId: port.productId
  }));
};
