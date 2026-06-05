import { Ticket } from '@/types';
import { formatDateTime, formatDrawLabel } from '@/utils/helpers';

export function printSaleTicket(ticket: Ticket): void {
  const hasSpecialAmounts = ticket.lines.some((line) => (line.specialAmount ?? 0) > 0);
  const regularTotal = ticket.lines.reduce((sum, line) => sum + line.amount, 0);
  const specialTotal = hasSpecialAmounts
    ? ticket.lines.reduce((sum, line) => sum + (line.specialAmount ?? 0), 0)
    : 0;
  const regularMultiplier = ticket.seller?.plan?.multiplier;
  const specialMultiplier = ticket.draw?.specialMultiplier?.value;

  const headerHtml = `
      <tr>
        <th style="text-align:left;">Numero</th>
        <th style="text-align:right;">Regular</th>
        <th style="text-align:right;">Especial</th>
        <th style="text-align:right;">Total</th>
      </tr>`;

  const linesHtml = ticket.lines
    .map(
      (line) => `
      <tr>
        <td>${line.number}</td>
        <td style="text-align:right;">C$ ${line.amount.toFixed(2)}</td>
        <td style="text-align:right;">C$ ${(line.specialAmount ?? 0).toFixed(2)}</td>
        <td style="text-align:right;">C$ ${(line.amount + (line.specialAmount ?? 0)).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const popup = window.open('', '_blank', 'width=420,height=760');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>Ticket ${ticket.code}</title>
        <style>
          body { font-family: monospace; padding: 16px; }
          .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          .title { text-align:center; font-weight:bold; font-size:18px; }
          .muted { color:#666; font-size:12px; }
          table { width:100%; border-collapse: collapse; margin-top: 8px; }
          td, th { font-size:12px; padding: 4px 0; border-bottom: 1px dashed #ddd; }
          .tot { font-weight: bold; margin-top: 8px; display:flex; justify-content:space-between; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="title">GameOver Loteria</div>
          <div class="title" style="font-size:16px; letter-spacing:2px; margin-top:6px;">${ticket.code}</div>
          <p class="muted">Sorteo: ${ticket.draw ? formatDrawLabel(ticket.draw) : ticket.drawId}</p>
          <p class="muted">Cliente: ${ticket.customerName}</p>
          <p class="muted">Vendedor: ${ticket.seller?.fullName ?? ticket.sellerId}</p>
          <p class="muted">Fecha: ${formatDateTime(ticket.createdAt)}</p>
          ${typeof regularMultiplier === 'number' ? `<p class="muted">Multiplicador regular: x${regularMultiplier}</p>` : ''}
          ${typeof specialMultiplier === 'number' ? `<p class="muted">Multiplicador especial: x${specialMultiplier}</p>` : ''}
          <table>
            <thead>${headerHtml}</thead>
            <tbody>${linesHtml}</tbody>
          </table>
          ${hasSpecialAmounts ? `
          <div class="tot" style="font-size:12px; font-weight:normal; color:#444; margin-top:6px;">
            <span>Subtotal regular</span>
            <span>C$ ${regularTotal.toFixed(2)}</span>
          </div>
          <div class="tot" style="font-size:12px; font-weight:normal; color:#444; margin-top:4px;">
            <span>Subtotal especial</span>
            <span>C$ ${specialTotal.toFixed(2)}</span>
          </div>` : ''}
          <div class="tot">
            <span>TOTAL</span>
            <span>C$ ${ticket.total.toFixed(2)}</span>
          </div>
        </div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
}
