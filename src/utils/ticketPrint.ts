import { Ticket } from '@/types';
import { formatDateTime, formatDrawLabel } from '@/utils/helpers';
import { loadFrontendTicketSettings } from '@/utils/ticketAppearance';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const groupLinesByAmount = (
  lines: Array<{ number: string; amount: number; specialAmount?: number | null }>,
  includeSpecial: boolean
) => {
  const groups = new Map<string, { numbers: string[]; regular: number; special: number }>();

  for (const line of lines) {
    const special = includeSpecial ? (line.specialAmount ?? 0) : 0;
    const key = includeSpecial
      ? `${line.amount.toFixed(2)}|${special.toFixed(2)}`
      : line.amount.toFixed(2);
    const current = groups.get(key);

    if (current) {
      current.numbers.push(line.number);
      continue;
    }

    groups.set(key, {
      numbers: [line.number],
      regular: line.amount,
      special,
    });
  }

  return Array.from(groups.values()).map((group) => ({
    number: group.numbers.join(', '),
    regular: group.regular,
    special: group.special,
    total: group.regular + group.special,
  }));
};

export async function printSaleTicket(ticket: Ticket): Promise<void> {
  const ticketSettings = await loadFrontendTicketSettings();
  const hasSpecialAmounts = ticket.lines.some((line) => (line.specialAmount ?? 0) > 0);
  const drawUsesSpecial = typeof ticket.draw?.specialMultiplier?.value === 'number'
    ? ticket.draw.specialMultiplier.value > 0
    : hasSpecialAmounts;
  const showSpecialColumn = drawUsesSpecial && hasSpecialAmounts;
  const regularTotal = ticket.lines.reduce((sum, line) => sum + line.amount, 0);
  const specialTotal = showSpecialColumn
    ? ticket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0)
    : 0;
  const regularMultiplier = ticket.seller?.plan?.multiplier;
  const specialMultiplier = ticket.draw?.specialMultiplier?.value;
  const effectiveMultiplier = showSpecialColumn && typeof specialMultiplier === 'number'
    ? specialMultiplier
    : regularMultiplier;
  const groupedLines = groupLinesByAmount(ticket.lines, showSpecialColumn);
  const customerName = (ticket.customerName ?? '').trim() || 'Anonimo';
  const drawLabel = ticket.draw ? formatDrawLabel(ticket.draw) : ticket.drawId;
  const drawDate = ticket.draw?.closeTime ? formatDateTime(ticket.draw.closeTime) : formatDateTime(ticket.createdAt);
  const puesto = ticket.seller?.fullName ?? ticket.sellerId;
  const footerNoteHtml = ticketSettings.footerNote
    ? escapeHtml(ticketSettings.footerNote).replace(/\n/g, '<br />')
    : '';

  const headerHtml = showSpecialColumn
    ? `
      <tr>
        <th style="text-align:left;">Numero</th>
        <th style="text-align:right;">Monto</th>
        <th style="text-align:right;">Especial</th>
      </tr>`
    : `
      <tr>
        <th style="text-align:left;">Numero</th>
        <th style="text-align:right;">Monto</th>
      </tr>`;

  const linesHtml = groupedLines
    .map(
      (line) => {
        if (showSpecialColumn) {
          return `
      <tr>
        <td>${line.number}</td>
        <td style="text-align:right;">C$ ${line.regular.toFixed(2)}</td>
        <td style="text-align:right;">C$ ${line.special.toFixed(2)}</td>
      </tr>`;
        }

        return `
      <tr>
        <td>${line.number}</td>
        <td style="text-align:right;">C$ ${line.regular.toFixed(2)}</td>
      </tr>`;
      }
    )
    .join('');

  const popup = window.open('', '_blank', 'width=420,height=760');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>Ticket ${ticket.code}</title>
        <style>
          body { font-family: "Courier New", monospace; padding: 10px; background: #f3f3f3; color: #0a0a0a; }
          .box { border: 1px solid #c9c9c9; border-radius: 6px; padding: 10px; background: #f7f7f7; }
          .title { text-align:center; font-weight:bold; font-size:28px; line-height:1.1; letter-spacing:0.5px; }
          .code { text-align:center; font-weight:bold; font-size:${ticketSettings.ticketCodeFontSize}px; letter-spacing:2px; margin: 8px 0 12px; }
          .line { font-size:22px; margin: 0 0 6px; }
          table { width:100%; border-collapse: collapse; margin-top: 10px; }
          td, th { font-size:22px; padding: 4px 0; border-bottom: 1px solid #dadada; }
          th { font-weight: bold; }
          .tot { font-weight: bold; margin-top: 10px; display:flex; justify-content:space-between; font-size:24px; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="title">${escapeHtml(ticketSettings.ticketTitle)}</div>
          <div class="code">${ticket.code}</div>
          <p class="line">${drawLabel}</p>
          <p class="line">F.Sorteo:${drawDate}</p>
          <p class="line">F.Ticket:${formatDateTime(ticket.createdAt)}</p>
          <p class="line">Cliente: ${customerName}</p>
          <p class="line">Puesto: ${puesto}</p>
          ${typeof regularMultiplier === 'number' ? `<p class="line">Multiplicador regular: x${regularMultiplier}</p>` : ''}
          ${showSpecialColumn && typeof specialMultiplier === 'number' ? `<p class="line">Multiplicador especial: x${specialMultiplier}</p>` : ''}
          <table>
            <thead>${headerHtml}</thead>
            <tbody>${linesHtml}</tbody>
          </table>
          ${showSpecialColumn ? `
          <div class="tot" style="font-size:18px; font-weight:normal; margin-top:6px;">
            <span>Subtotal regular</span>
            <span>C$ ${regularTotal.toFixed(2)}</span>
          </div>
          <div class="tot" style="font-size:18px; font-weight:normal; margin-top:4px;">
            <span>Subtotal especial</span>
            <span>C$ ${specialTotal.toFixed(2)}</span>
          </div>` : ''}
          <div class="tot">
            <span>TOTAL</span>
            <span>C$ ${ticket.total.toFixed(2)}</span>
          </div>
          ${typeof effectiveMultiplier === 'number' ? `
          <p class="line" style="text-align:center; margin-top:12px;">Multiplicador: ${effectiveMultiplier}x</p>` : ''}
          ${footerNoteHtml ? `
          <p class="line" style="text-align:center; margin-top:6px; white-space:normal;">${footerNoteHtml}</p>` : ''}
        </div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
}
