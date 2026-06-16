import { TicketPayload } from "./types.js";

const ESC = 0x1b;
const GS = 0x1d;

const hr = (len: number) => "-".repeat(len);

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

const wrapGroupedNumbers = (value: string, width: number) => {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const candidate = current ? `${current}, ${token}` : token;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = token;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
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

const formatTicketDate = (value?: string) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
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
  const detailLines = ticket.detailLines ?? [];
  const hasSpecialAmounts = detailLines.some((line) => line.special > 0);
  const drawHasSpecial = typeof ticket.multipliers?.special === "number" && ticket.multipliers.special > 0;
  const showSpecialColumn = ticket.showSpecialColumn ?? (drawHasSpecial && hasSpecialAmounts);

  b.init();
  b.align("center");
  b.bold(true).text(ticket.businessName ?? "GameOver Loteria");
  if (ticket.ticketNumber) {
    b.text(ticket.ticketNumber);
  }
  b.bold(false);

  b.align("left");
  if (ticket.drawLabel || ticket.title) {
    b.text(ticket.drawLabel ?? ticket.title ?? "");
  }
  if (ticket.drawDateIso) {
    b.text(`Fecha sorteo: ${formatTicketDate(ticket.drawDateIso)}`);
  }
  const customerName = (ticket.customerName ?? "").trim() || "Anonimo";
  b.text(`Cliente: ${customerName}`);
  if (ticket.sellerName || ticket.cashier) {
    b.text(`Puesto: ${ticket.sellerName ?? ticket.cashier}`);
  }
  if (!ticket.drawDateIso && ticket.dateIso) {
    b.text(`Fecha sorteo: ${formatTicketDate(ticket.dateIso)}`);
  }

  b.text(hr(columns));

  if (detailLines.length) {
    if (showSpecialColumn) {
      const { numberWidth, regularWidth, specialWidth, totalWidth } = getDetailColumnWidths(columns);
      const amountWidth = regularWidth;
      const effectiveNumberWidth = Math.max(8, numberWidth + Math.max(0, totalWidth - 2));

      b.bold(true).text(
        `${padRight("Numero", effectiveNumberWidth)} ${padRight("Monto", amountWidth)} ${padRight("Especial", specialWidth)}`
      );
      b.bold(false);

      for (const line of detailLines) {
        const wrappedNumbers = wrapGroupedNumbers(line.number, effectiveNumberWidth);
        wrappedNumbers.forEach((numberLine, index) => {
          if (index === 0) {
            b.text(
              `${padRight(numberLine, effectiveNumberWidth)} ${padLeft(`C$ ${line.regular.toFixed(2)}`, amountWidth)} ${padLeft(`C$ ${line.special.toFixed(2)}`, specialWidth)}`
            );
            return;
          }

          b.text(`${padRight(numberLine, effectiveNumberWidth)} ${padRight("", amountWidth)} ${padRight("", specialWidth)}`);
        });
      }
    } else {
      const amountWidth = columns <= 32 ? 10 : 12;
      const numberWidth = Math.max(12, columns - amountWidth - 1);

      b.bold(true).text(
        `${padRight("Numero", numberWidth)} ${padRight("Monto", amountWidth)}`
      );
      b.bold(false);

      for (const line of detailLines) {
        const wrappedNumbers = wrapGroupedNumbers(line.number, numberWidth);
        wrappedNumbers.forEach((numberLine, index) => {
          if (index === 0) {
            b.text(`${padRight(numberLine, numberWidth)} ${padLeft(`C$ ${line.regular.toFixed(2)}`, amountWidth)}`);
            return;
          }

          b.text(numberLine);
        });
      }
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

  b.align("right").bold(true).text(`TOTAL: C$ ${formatMoney(ticket.totals.total)}`);
  b.bold(false);

  b.align("left");

  if (ticket.qrText) {
    b.text(hr(columns));
    b.align("center");
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
