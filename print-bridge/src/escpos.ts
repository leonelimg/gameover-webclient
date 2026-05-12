import { TicketPayload } from "./types.js";

const ESC = 0x1b;
const GS = 0x1d;

const hr = (len: number) => "-".repeat(len);

const padBoth = (text: string, width: number) => {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const totalPadding = width - text.length;
  const left = Math.floor(totalPadding / 2);
  const right = totalPadding - left;
  return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
};

const padRight = (text: string, width: number) => {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return `${text}${" ".repeat(width - text.length)}`;
};

const padLeft = (text: string, width: number) => {
  if (text.length >= width) {
    return text.slice(text.length - width);
  }
  return `${" ".repeat(width - text.length)}${text}`;
};

const getDetailColumnWidths = (columns: number) => {
  // 3 separator spaces are used between the 4 columns.
  if (columns <= 32) {
    // Typical 58mm layout
    return {
      numberWidth: 5,
      regularWidth: 8,
      specialWidth: 8,
      totalWidth: 8,
    };
  }

  if (columns >= 48) {
    // Typical 80mm layout
    return {
      numberWidth: 8,
      regularWidth: 12,
      specialWidth: 12,
      totalWidth: 13,
    };
  }

  const numberWidth = Math.max(6, Math.floor(columns * 0.2));
  const regularWidth = Math.max(9, Math.floor(columns * 0.24));
  const specialWidth = Math.max(9, Math.floor(columns * 0.24));
  const totalWidth = Math.max(9, columns - numberWidth - regularWidth - specialWidth - 3);

  return { numberWidth, regularWidth, specialWidth, totalWidth };
};

const formatMoney = (value?: number) => {
  if (typeof value !== "number") {
    return "";
  }
  return value.toFixed(2);
};

export class EscPosBuilder {
  private chunks: Buffer[] = [];

  init() {
    this.raw(Buffer.from([ESC, 0x40]));
    return this;
  }

  align(mode: "left" | "center" | "right") {
    const n = mode === "left" ? 0 : mode === "center" ? 1 : 2;
    this.raw(Buffer.from([ESC, 0x61, n]));
    return this;
  }

  bold(enabled: boolean) {
    this.raw(Buffer.from([ESC, 0x45, enabled ? 1 : 0]));
    return this;
  }

  text(value: string, newline = true) {
    this.raw(Buffer.from(value, "ascii"));
    if (newline) {
      this.raw(Buffer.from("\n", "ascii"));
    }
    return this;
  }

  feed(lines = 1) {
    this.raw(Buffer.from([ESC, 0x64, lines]));
    return this;
  }

  cut() {
    this.raw(Buffer.from([GS, 0x56, 0x41, 0x00]));
    return this;
  }

  qr(text: string) {
    const storeLen = text.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;

    this.raw(Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
    this.raw(Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]));
    this.raw(Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30]));
    this.raw(Buffer.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]));
    this.raw(Buffer.from(text, "ascii"));
    this.raw(Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));
    return this;
  }

  raw(data: Buffer) {
    this.chunks.push(data);
    return this;
  }

  build() {
    return Buffer.concat(this.chunks);
  }
}

export const buildSimpleTextPrint = (text: string) => {
  return new EscPosBuilder()
    .init()
    .align("left")
    .text(text)
    .feed(2)
    .cut()
    .build();
};

export const buildTicketPrint = (ticket: TicketPayload, columns: number) => {
  const b = new EscPosBuilder();

  b.init();
  b.align("center");
  b.bold(true).text(ticket.title ?? "TICKET");
  b.bold(false);

  if (ticket.businessName) {
    b.text(ticket.businessName);
  }
  if (ticket.businessTaxId) {
    b.text(`RNC: ${ticket.businessTaxId}`);
  }

  b.text(hr(columns));

  b.align("left");
  if (ticket.ticketNumber) {
    b.text(`Ticket: ${ticket.ticketNumber}`);
  }
  if (ticket.dateIso) {
    b.text(`Fecha: ${ticket.dateIso}`);
  }
  if (ticket.cashier) {
    b.text(`Cajero: ${ticket.cashier}`);
  }
  if (ticket.terminal) {
    b.text(`Terminal: ${ticket.terminal}`);
  }
  if (ticket.multipliers?.regular) {
    b.text(`Multiplicador regular: x${ticket.multipliers.regular}`);
  }
  if (ticket.multipliers?.special) {
    b.text(`Multiplicador especial: x${ticket.multipliers.special}`);
  }

  b.text(hr(columns));
  b.bold(true).text("DETALLE");
  b.bold(false);

  if (ticket.detailLines?.length) {
    const { numberWidth, regularWidth, specialWidth, totalWidth } = getDetailColumnWidths(columns);

    b.text(
      `${padRight("Numero", numberWidth)} ${padRight("Regular", regularWidth)} ${padRight("Especial", specialWidth)} ${padRight("Total", totalWidth)}`
    );

    for (const line of ticket.detailLines) {
      b.text(
        `${padRight(line.number, numberWidth)} ${padLeft(`C$${line.regular.toFixed(2)}`, regularWidth)} ${padLeft(`C$${line.special.toFixed(2)}`, specialWidth)} ${padLeft(`C$${line.total.toFixed(2)}`, totalWidth)}`
      );
    }
  } else {
    for (const item of ticket.items) {
      const name = item.label.slice(0, columns - 1);
      b.text(name);

      const qty = item.qty ?? 1;
      const unit = formatMoney(item.unitPrice);
      const total = formatMoney(item.total);
      const line = `${qty} x ${unit}`;

      b.text(`${padRight(line, columns - total.length)}${total}`);
    }
  }

  b.text(hr(columns));

  b.align("right");
  if (typeof ticket.totals.subtotal === "number") {
    b.text(`Subtotal: ${formatMoney(ticket.totals.subtotal)}`);
  }
  if (typeof ticket.totals.discount === "number") {
    b.text(`Descuento: ${formatMoney(ticket.totals.discount)}`);
  }

  b.bold(true).text(`TOTAL: ${formatMoney(ticket.totals.total)}`);
  b.bold(false);

  if (typeof ticket.totals.paid === "number") {
    b.text(`Pago: ${formatMoney(ticket.totals.paid)}`);
  }
  if (typeof ticket.totals.change === "number") {
    b.text(`Cambio: ${formatMoney(ticket.totals.change)}`);
  }

  b.align("left");
  if (ticket.notes?.length) {
    b.text(hr(columns));
    for (const note of ticket.notes) {
      b.text(note);
    }
  }

  if (ticket.qrText) {
    b.text(hr(columns));
    b.align("center");
    b.text(padBoth("Verificar ticket", columns));
    b.qr(ticket.qrText);
  }

  if (ticket.footer?.length) {
    b.align("center");
    for (const line of ticket.footer) {
      b.text(line);
    }
  }

  b.feed(3);
  b.cut();

  return b.build();
};
