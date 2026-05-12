import { SerialPort } from "serialport";

export class SerialPrinter {
  constructor(
    private readonly path: string,
    private readonly baudRate: number
  ) {}

  async printRaw(data: Buffer): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const port = new SerialPort({
        path: this.path,
        baudRate: this.baudRate,
        autoOpen: false
      });

      const closeSafely = () => {
        if (!port.isOpen) {
          return;
        }
        port.close((closeError) => {
          if (closeError) {
            reject(closeError);
          }
        });
      };

      port.open((openError) => {
        if (openError) {
          reject(openError);
          return;
        }

        port.write(data, (writeError) => {
          if (writeError) {
            closeSafely();
            reject(writeError);
            return;
          }

          port.drain((drainError) => {
            if (drainError) {
              closeSafely();
              reject(drainError);
              return;
            }

            port.close((closeError) => {
              if (closeError) {
                reject(closeError);
                return;
              }
              resolve();
            });
          });
        });
      });
    });
  }

  static async listPorts() {
    return SerialPort.list();
  }
}
