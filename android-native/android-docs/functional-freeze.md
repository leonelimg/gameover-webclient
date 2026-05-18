# Functional freeze (Web/Backend parity -> Android)

## Confirmed scope

- Winning tickets module in Android is **report only**.
- Offline basic supports **sales queue for later sync**.
- Android minimum version: **8+** (`minSdk 26`).
- Ticket print format must be identical to current web flow (ESC/POS, QR, cut).
- Ticket code camera scanning is required.
- Commission report is read-only.
- Permissions must use backend `resourceKey` semantics unchanged.

## Auth & session

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/roles/my-permissions`

## Dashboard

- `GET /api/reports/summary`
- `GET /api/reports/recent-tickets`
- `GET /api/reports/top-numbers`

## Sales

- `GET /api/draws`
- `POST /api/tickets`
- Validation parity:
  - draw open by cutoff (`closeTime - minutosPreviosCierre`)
  - 2-digit number
  - amount > 0
  - special <= regular
  - restricted numbers limit
  - no sales in finalized draw

## Tickets management

- `PATCH /api/tickets/:id/print` (reprint flow)
- `PATCH /api/tickets/:id/cancel` (optional reason)
- Do not print canceled tickets.

## Reports

- Winner tickets (read-only): `GET /api/payments/winning-tickets`
- Commissions/read-only: `GET /api/reports/summary`, `GET /api/reports/balance-breakdown`

## Financial formula parity

- Prize:
  - regular: `line.amount * plan.multiplier`
  - special: `(line.amount + line.specialAmount) * plan.multiplier * draw.specialMultiplier`
- Commission:
  - `ticket.total * (plan.commission / 100)`
