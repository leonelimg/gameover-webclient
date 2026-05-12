import { config } from "../config.js";
import { SerialPrinter } from "./serialPrinter.js";

export interface PrinterTransport {
  printRaw(data: Buffer): Promise<void>;
}

export const printerTransport: PrinterTransport = new SerialPrinter(
  config.printer.serialPort,
  config.printer.serialBaud
);

export const getPrinterInfo = () => ({
  transport: config.printer.transport,
  port: config.printer.serialPort,
  baudRate: config.printer.serialBaud
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
