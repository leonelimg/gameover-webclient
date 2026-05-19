# Functional freeze (Web/Backend parity -> Android)

## Confirmed scope

- Winning tickets module in Android is **report only**.
- Offline basic supports **sales queue for later sync**.
- Android minimum version: **8+** (`minSdk 26`).
- Ticket print format must be identical to current web flow (ESC/POS, QR, cut).
- Ticket code camera scanning is required.
- Commission report is read-only.
- Permissions must use backend `resourceKey` semantics unchanged.

## Frozen scope checklist

- Android base: **Kotlin + MVVM + Compose Material 3 + Navigation + Hilt + Room + Retrofit + Coroutines/Flow**.
- Platform baseline: **Android 8+** (`minSdk 26`).
- Winner tickets: **read-only report only** (no `mark-paid`/`revert` in Android).
- Commissions: **read-only**.
- Offline basic: **sales queue for deferred sync**.
- Ticket scanning by camera: **required**.
- Ticket format: **same web parity** (ESC/POS, QR, cut).
- Permissions: **same backend `resourceKey` rules**.

## Web/Backend → Android parity matrix by screen

| Android screen/module | Backend endpoints | Notes |
|---|---|---|
| Login | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/roles/my-permissions` | Session restore + rotating refresh + permission bootstrap |
| Dashboard | `GET /api/reports/summary`, `GET /api/reports/recent-tickets`, `GET /api/reports/top-numbers` | Same date-range behavior (`today/last7/week/month/custom`) |
| Sales / Ventas | `GET /api/draws`, `POST /api/tickets` | Business rules must match backend before submit |
| Ticket management (list/filter/detail) | `GET /api/reports/sales-by-user`, `GET /api/tickets/:id` | Uses same hierarchy/resource permissions |
| Ticket reprint | `PATCH /api/tickets/:id/print` | Must block canceled tickets |
| Ticket cancel | `PATCH /api/tickets/:id/cancel` | Optional reason, keep backend messages |
| Winner tickets report (read-only) | `GET /api/payments/winning-tickets` | No mark-paid/revert in Android scope |
| Commissions report (read-only) | `GET /api/reports/balance-breakdown` | Read-only analytics |

## Critical business rules to replicate 1:1

- Sales window open only before cutoff: `closeTime - minutosPreviosCierre`.
- Numbers must be exactly **2 digits**.
- Regular amount must be **> 0**.
- `specialAmount <= regularAmount` when special multiplier exists.
- Restricted numbers must not exceed configured draw limit.
- Sales are forbidden for draws with `status = finalizado`.
- Reprint is forbidden for canceled tickets (`canceledAt != null`).

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
