# Contexto API y Sistema para Android (GameOver)

## 1) Objetivo de este documento
Este archivo resume el contexto técnico mínimo y práctico para que otra IA pueda trabajar rápido sobre el proyecto Android sin romper contratos con el backend.

Incluye:
- Arquitectura general del sistema.
- Contratos API reales (según código backend y cliente Android).
- Flujo de autenticación y refresh de token.
- Reglas de negocio críticas (tickets, sorteos, permisos).
- Mapeo de lo que Android ya consume y lo que aún no consume.
- Riesgos actuales conocidos.

## 2) Arquitectura general
- **Frontend web**: React + Vite en la raíz del repo.
- **Backend API**: Node.js + Express + Prisma en carpeta `server`.
- **Android nativo**: proyecto multi-módulo en `android-native`.
- **Impresión Windows bridge**: servicio `print-bridge` (no usado por Android para imprimir; Android usa Bluetooth nativo ESC/POS).

Arquitectura Android (resumen):
- `app`: arranque, navegación, DI principal y `API_BASE_URL`.
- `core/core-network`: Retrofit, OkHttp, interceptores, DTOs, APIs.
- `core/core-data`: repositorios, DataStore de tokens, Room (cola offline).
- `core/core-domain`: modelos y casos de uso.
- `feature-*`: pantallas y ViewModels (auth, dashboard, sales, tickets, settings, bluetooth).

## 3) Backend API base y seguridad
- Base local por defecto backend: `http://localhost:4000`.
- Health check: `GET /health`.
- Rutas API prefijadas con `/api/...`.
- CORS, Helmet, rate limit y JWT habilitados en backend.
- Zona horaria de referencia en el backend (offset para parseo de fechas): `-06:00` (Central America).

Rate limits relevantes:
- Auth (`/api/auth/*`): límite más estricto (20 req / 15 min).
- Resto de API: límite general (200 req / min).

Auth:
- Access token corto (JWT).
- Refresh token rotativo persistido en DB (`refresh_tokens`).

## 4) Modelo de negocio clave (backend)
Entidades principales:
- `users`, `plans`, `draws`, `restricted_numbers`, `global_number_restrictions`, `user_restriction_limits`, `tickets`, `ticket_lines`, `role_permissions`, `system_settings`, `special_multipliers`, `cash_movements`, `announcements`.

Enums clave:
- Rol usuario: `admin`, `asociado`, `vendedor`.
- Estado usuario: `activo`, `bloqueado`, `archivado`.
- Estado sorteo: `pendiente`, `abierto`, `cerrado`, `finalizado`.
- Estado pago ticket: `pendiente`, `pagado`.
- Tipo de movimiento de caja: `deposito`, `retiro`.

## 5) RBAC (permisos)
El backend usa permisos por recurso/acción (granular), no solo por rol fijo.

Ejemplos de resource keys:
- `/sales`, `/sales:create`, `/sales:cancel`
- `/draws`, `/draws:create`, `/draws:update`, `/draws:delete`
- `/ticket-payments:*`
- `/reports/*`
- `/cash-movements`, `/cash-movements:create`, `/cash-movements:cancel`

Implicación para Android:
- Un 403 casi siempre indica falta de permiso RBAC para ese endpoint/recurso.
- No asumir que por rol ya se tiene acceso a todas las acciones de una pantalla.

## 6) Catálogo de endpoints y campos
Esta es la sección que otra IA necesita leer primero. Resume método, entrada y salida de cada endpoint real del backend.

### 6.1 AuthApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `POST /api/auth/login` | `{ username, password }` | `{ accessToken, refreshToken, user }` | `user` incluye `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt` |
| `POST /api/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` | El refresh rota el token viejo por un par nuevo en base de datos. |
| `POST /api/auth/logout` | Sin body | `{ message }` | Revoca todos los refresh tokens activos del usuario. |
| `GET /api/auth/me` | Sin body | `{ id, fullName, username, email, phone, role, status, planId, parentId, createdAt, updatedAt }` | Requiere token válido (Bearer). |

---

### 6.2 DrawsApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/draws` | Sin body | Lista de sorteos con `id`, `name`, `closeTime`, `minutosPreviosCierre`, `winnerNumber`, `status`, `restrictedNumbers`, `specialMultiplier`, `createdAt` | Android lo usa para seleccionar sorteos abiertos. |
| `GET /api/draws/search` | Query: `fromDate?`, `toDate?`, `page`, `pageSize` | `{ items, total, page, pageSize, totalPages }` | `items` tiene la misma forma que `GET /api/draws`. Rango de fechas filtra por `closeTime`. |
| `GET /api/draws/:id` | Param `id` | Un sorteo completo | Incluye restricciones y multiplicador especial si aplica. |
| `POST /api/draws` | `{ name, closeTime, minutosPreviosCierre, winnerNumber?, specialMultiplierId? }` | Sorteo creado | `closeTime` debe ser ISO datetime. |
| `PATCH /api/draws/:id` | Campos parciales del sorteo | Sorteo actualizado | Recalcula `status` según horario y número ganador. |
| `DELETE /api/draws/:id` | Param `id` | 204 sin body | Elimina el sorteo. |
| `POST /api/draws/:id/restricted-numbers` | `{ number, limit }` | `{ id, number, limit, createdAt, updatedAt }` | **¡Importante!** Aunque la ruta usa `:id`, el backend actualmente aplica/upserta esto a las restricciones globales (`GlobalNumberRestriction`) por número, no específicas al sorteo. |
| `DELETE /api/draws/:id/restricted-numbers/:number` | Param `id`, param `number` | 204 sin body | **¡Importante!** Elimina la restricción global (`GlobalNumberRestriction`) para ese número. |

---

### 6.3 TicketsApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/tickets` | Query opcional: `drawId`, `sellerId`, `associateId`, `code`, `includeCanceled`, `fromDate`, `toDate` | Lista de tickets | Cada ticket trae `id`, `code`, `drawId`, `sellerId`, `associateId`, `customerName`, `lines`, `total`, `createdAt`, `printedAt`, `paymentStatus`, `paidAt`, `canceledAt`, `canceledById`, `cancelReason`, `draw`, `seller`, `associate`. Rango de fechas filtra por `createdAt`. |
| `GET /api/tickets/:id` | Param `id` | Ticket completo | `draw` incluye `closeTime` y `minutosPreviosCierre`; `seller` y `associate` incluyen datos resumen y el plan del vendedor. |
| `POST /api/tickets` | `{ drawId, customerName, lines[] }` | Ticket creado | Cada línea en body: `{ number, amount, isNicaEspecial }`. El backend valida límites de usuario, globales y del sorteo antes de crear el ticket. |
| `PATCH /api/tickets/:id/print` | Param `id` | Ticket actualizado | Marca `printedAt = new Date()`. |
| `PATCH /api/tickets/:id/cancel` | Param `id`, body `{ reason? }` | Ticket actualizado | Marca `canceledAt`, `canceledById` y `cancelReason`. Bloqueado si el sorteo está cerrado o tiene ganador. |

Campos de `TicketDto` que Android ya mapea:
- Ticket: `id`, `code`, `drawId`, `sellerId`, `associateId`, `customerName`, `lines`, `total`, `createdAt`, `printedAt`, `paymentStatus`, `paidAt`, `canceledAt`, `canceledById`, `cancelReason`.
- `lines[]`: `number`, `amount`, `specialAmount?`, `isNicaEspecial`.
- `draw?`: `id`, `name`, `specialMultiplier?`.
- `seller?` y `associate?`: `id`, `fullName`, `username`.

---

### 6.4 ReportsApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/reports/summary` | Query opcional: `drawId`, `fromDate`, `toDate` | `{ ticketCount, totalSales, totalPrizes, totalCommissions, userCount, drawCount }` | Resumen general financiero y de volumen según filtros de fecha e IP. |
| `GET /api/reports/top-numbers` | Query: `drawId?`, `limit?`, `fromDate?`, `toDate?`, `includeAllDraws?` | Lista de `{ number, total }` | **Desalineación conocida**: Android hoy espera `totalAmount` y `ticketCount` pero el backend solo responde `number` y `total` (suma de amount). |
| `GET /api/reports/recent-tickets` | Query opcional: `drawId?`, `limit?`, `fromDate?`, `toDate?` | Lista de tickets recientes | El backend devuelve datos de `draw` y `seller`. |
| `GET /api/reports/hierarchy` | Query opcional: `drawId`, `fromDate`, `toDate` | Árbol/Jerarquía de usuarios con ventas | Lista de nodos `{ user, totalSales, ticketCount, children: [...] }` |
| `GET /api/reports/balance-breakdown` | Query opcional: `drawId`, `userId`, `fromDate`, `toDate` | `{ filters, totals, rows, byVendor, byDraw, byAssociate }` | Desglose financiero muy detallado (ventas, premios, comisiones, balances). |
| `GET /api/reports/sales-by-user` | Query opcional: `drawId`, `userId`, `fromDate`, `toDate` | `{ filters, totals, rows, tickets }` | Ventas resumidas y lista detallada de tickets con sus estados. |
| `GET /api/reports/draw-lists` | Query opcional: `drawId`, `userId`, `fromDate`, `toDate` | `{ filters, totals, numbers }` | Contiene un desglose del "00" al "99" con el monto total vendido por número. |
| `GET /api/reports/commissions` | Query opcional: `drawId`, `userId`, `fromDate`, `toDate` | `{ filters, totals, bySeller }` | Comisiones detalladas calculadas por vendedor/asociado y sorteo. |

---

### 6.5 Plans

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/plans` | Sin body | Lista de planes | Cada plan trae `id`, `name`, `multiplier`, `commission` (porcentaje 0-100), `createdAt`, `updatedAt`, `masterId`, `master`. Filtrado por jerarquía si no es admin. |
| `GET /api/plans/:id` | Param `id` | Un plan completo | Devuelve 404 si el plan no pertenece a la jerarquía visible. |
| `POST /api/plans` | `{ name, multiplier, commission, masterId? }` | Plan creado | Requiere permiso `/plans:create`. |
| `PATCH /api/plans/:id` | Campos parciales del plan | Plan actualizado | Requiere permiso `/plans:update`. |
| `DELETE /api/plans/:id` | Param `id` | 204 sin body | Requiere permiso `/plans:delete`. |

---

### 6.6 Users

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/users` | Query opcional: `role`, `status`, `search` | Lista de usuarios | Si el usuario es asociado, solo ve sus datos y los de sus subordinados. No expone passwordHash. |
| `GET /api/users/:id` | Param `id` | Un usuario | Devuelve `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt`. |
| `POST /api/users` | `{ fullName, username, email, phone?, role, password, planId?, parentId? }` | Usuario creado | El password se hashea con bcrypt. Un asociado no puede crear administradores. |
| `PATCH /api/users/:id` | Campos parciales del usuario | Usuario actualizado | Si cambia email/username, valida duplicados. |
| `PATCH /api/users/:id/password` | `{ password }` | `{ message }` | Hashea y actualiza la contraseña del usuario. |
| `PATCH /api/users/:id/status` | `{ status }` | Usuario actualizado | Estados válidos: `activo`, `bloqueado`, `archivado`. Un usuario no puede auto-bloquearse. |

---

### 6.7 Ticket payments

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/payments/winning-tickets` | Query: `drawId` (requerido), `status?` ('all', 'pendiente', 'pagado'), `code?` | `{ draw, tickets[], paidTickets[], totals }` | `draw` incluye `hasWinnerNumber`. `tickets[]` son tickets ganadores con `prizeAmount`, `winningNumbers` (array), `seller` con su plan, `paidBy`, etc. |
| `PATCH /api/payments/mark-paid` | `{ ticketId?, code? }` (al menos uno requerido) | `{ ticket, prizeAmount }` | Valida permisos, si el ticket no está anulado, si tiene número ganador y si el sorteo ya tiene ganador. Cambia `paymentStatus = pagado`. |
| `PATCH /api/payments/:id/revert` | Param `id` | Ticket actualizado | Revierte el estado del pago a `pendiente`. |

---

### 6.8 Cash movements

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/cash-movements/targets` | Sin body | Lista de usuarios destino | Filtra según jerarquía del usuario y expone `canOperate` (si el usuario actual tiene permisos y no es el mismo). |
| `GET /api/cash-movements` | Query: `targetUserId?`, `type?`, `fromDate?`, `toDate?`, `limit?` | Lista de movimientos | Cada movimiento incluye `createdBy`, `targetUser` y el balance acumulado posterior `balanceAfterTransaction`. |
| `GET /api/cash-movements/balance` | Query: `targetUserId?`, `fromDate?`, `toDate?` | `{ targetUser, totals, filters }` | `totals` tiene `openingBalance`, `totalDeposits`, `totalWithdrawals`, `totalSales`, `totalPrizes`, `balance`. |
| `GET /api/cash-movements/summary-by-event` | Query: `targetUserId?`, `fromDate?`, `toDate?` | `{ targetUser, totals, filters, rows[] }` | Contiene el desglose financiero histórico agrupado por sorteos/eventos. |
| `POST /api/cash-movements` | `{ targetUserId, type, amount, note? }` | Movimiento creado | `type`: `deposito` o `retiro`. No se permite operar con administradores, usuarios inactivos, ni con uno mismo. |
| `PATCH /api/cash-movements/:id/cancel` | Param `id`, body `{ reason? }` | Movimiento actualizado | Cancela el movimiento. Solo lo puede realizar el creador del movimiento o sus superiores en la jerarquía. |

---

### 6.9 Announcements

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/announcements/active` | Sin body | Lista de anuncios activos | Filtra por rango de fecha actual y excluye aquellos descartados por el usuario logueado. |
| `GET /api/announcements` | Sin body | Lista completa | Para administradores (requiere permiso `/announcements`). |
| `POST /api/announcements/:id/dismiss` | Param `id` | 204 sin body | Registra el descarte del anuncio por el usuario logueado en la tabla `announcement_dismissals`. |
| `POST /api/announcements` | multipart/form-data: `name`, `message?`, `startDate`, `endDate`, `image?` (archivo) | Anuncio creado | Sube y guarda la imagen en `/public/announcements`. |
| `PATCH /api/announcements/:id` | multipart/form-data parcial + `clearImage?` | Anuncio actualizado | Si se sube una nueva imagen o `clearImage = 'true'`, borra la imagen física vieja del servidor. |
| `DELETE /api/announcements/:id` | Param `id` | 204 sin body | Elimina el registro y la imagen física del servidor. |

---

### 6.10 Roles y permisos

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/roles/my-permissions` | Sin body | `{ permissions: string[] }` | Retorna las resource keys permitidas para el rol del usuario actual. |
| `GET /api/roles/permissions` | Sin body | `{ permissions: [...] }` | Matriz de permisos completa por rol. Requiere permiso `/roles`. |
| `PATCH /api/roles/permissions` | `{ permissions: [{ resourceKey, asociado, vendedor }] }` | `{ permissions: [...] }` | Valida resourceKey y actualiza en bloque los permisos asignados a cada rol. |

---

### 6.11 Special multipliers

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/special-multipliers` | Sin body | Lista de multiplicadores | Cada item tiene `id`, `name`, `value` (1-10), `createdAt`, `updatedAt`. |
| `GET /api/special-multipliers/:id` | Param `id` | Multiplicador | Retorna 404 si no existe. |
| `POST /api/special-multipliers` | `{ name, value }` | Multiplicador creado | `value` debe ser entero entre 1 y 10. |
| `PATCH /api/special-multipliers/:id` | `{ name?, value? }` | Multiplicador actualizado | Permite cambios parciales. |
| `DELETE /api/special-multipliers/:id` | Param `id` | 204 sin body | Elimina el multiplicador. |

---

### 6.12 Number restrictions

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/number-restrictions/global` | Sin body | `{ globalLimit: number \| null }` | Obtiene el límite general predeterminado para ventas por número. |
| `GET /api/number-restrictions/me-limits` | Sin body | `{ userGlobalLimit: number \| null, userDrawSaleLimit: number \| null }` | Obtiene los límites de restricción asignados al usuario actual. |
| `PATCH /api/number-restrictions/global` | `{ globalLimit: number \| null }` | `{ globalLimit }` | Modifica el límite general de ventas por número. |
| `GET /api/number-restrictions/global-numbers` | Sin body | `{ items: [{ id, number, limit, createdAt, updatedAt }, ...] }` | Obtiene la lista de restricciones globales específicas de dos dígitos por número. |
| `POST /api/number-restrictions/global-numbers` | `{ number, limit }` | `{ id, number, limit, createdAt, updatedAt }` | Crea o actualiza (upsert) la restricción global para un número específico. |
| `PATCH /api/number-restrictions/global-numbers/:number` | `{ limit }` | `{ id, number, limit, createdAt, updatedAt }` | Actualiza la restricción de un número global específico. |
| `DELETE /api/number-restrictions/global-numbers/:number` | Param `number` | 204 sin body | Elimina la restricción global del número enviado. |
| `GET /api/number-restrictions/users-limits` | Query opcional: `search?` | `{ items: [...] }` | Lista de usuarios con sus límites individuales de venta por número (`userGlobalLimit`) y por sorteo (`userDrawSaleLimit`). |
| `PATCH /api/number-restrictions/users/:userId/global-limit` | `{ limit: number \| null }` | `{ userId, userGlobalLimit, userDrawSaleLimit }` | Modifica el límite de venta por número asignado a un usuario específico. |
| `PATCH /api/number-restrictions/users/:userId/draw-sale-limit` | `{ limit: number \| null }` | `{ userId, userGlobalLimit, userDrawSaleLimit }` | Modifica el límite total de venta por sorteo asignado a un usuario específico. |

---

### 6.13 Print bridge (Servicio de Impresión Windows)

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/print-bridge/installer` | Sin body | `{ fileName, sizeBytes, updatedAt, downloadUrl }` | Busca los instaladores en el servidor, prioriza `.zip` sobre `.exe` y retorna la info del instalador más nuevo. |
| `GET /api/print-bridge/installer/download` | Sin body | Descarga de archivo binario | Endpoint directo para descargar el instalador del bridge. |

---

### 6.14 Frontend settings

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/frontend-settings/ticket-vendor-widths` | Sin body | `{ defaultTicketWidth, sellers[] }` | Obtiene anchos de papel (58mm o 80mm) para vendedores. |
| `GET /api/frontend-settings/ticket-appearance` | Sin body | `{ ticketTitle, footerNote, ticketCodeFontSize, defaultTicketWidth, sellerTicketWidths }` | Obtiene la configuración de diseño/apariencia del ticket de venta. |
| `PATCH /api/frontend-settings/ticket-appearance` | `{ ticketTitle, footerNote, ticketCodeFontSize, defaultTicketWidth, sellerTicketWidths }` | `{ ticketTitle, footerNote, ticketCodeFontSize, defaultTicketWidth, sellerTicketWidths }` | Actualiza la configuración de apariencia de tickets. |
| `GET /api/frontend-settings/reporting-filters` | Sin body | `{ sections: { [sectionKey]: { requireFinalized, requireWinnerDefined } } }` | Obtiene las configuraciones de filtros para las secciones de reportes. |
| `PATCH /api/frontend-settings/reporting-filters` | `{ sections: { [sectionKey]: { requireFinalized, requireWinnerDefined } } }` | Configuración actualizada | Guarda el comportamiento de obligatoriedad de sorteo finalizado y ganador definido para reportes. |

---

### 6.15 DTOs Android más importantes
- `LoginResponse`: `accessToken`, `refreshToken`, `user`.
- `UserDto`: `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt`.
- `DrawDto`: `id`, `name`, `closeTime`, `minutosPreviosCierre`, `winnerNumber`, `status`, `restrictedNumbers`, `specialMultiplier`, `createdAt`.
- `TicketDto`: `id`, `code`, `drawId`, `sellerId`, `associateId`, `customerName`, `lines`, `total`, `createdAt`, `printedAt`, `paymentStatus`, `paidAt`, `canceledAt`, `canceledById`, `cancelReason`, `draw`, `seller`, `associate`.
- `ReportSummaryDto`: `ticketCount`, `totalSales`, `totalPrizes`, `totalCommissions`, `userCount`, `drawCount`.
- `TopNumberDto`: Android espera `{ number, totalAmount, ticketCount }` pero el backend actualmente responde `{ number, total }`. Requiere mapeo adaptativo.

## 7) Reglas de negocio críticas para tickets/sales
- El número de apuesta debe ser exactamente 2 dígitos (`^\d{2}$`).
- Debe haber al menos una línea en el ticket.
- No se puede vender si el sorteo está fuera de horario (cutoff por `closeTime - minutosPreviosCierre`).
- Restricciones por número:
  1. Primero aplica la restricción individual del número registrada de forma global (`GlobalNumberRestriction`).
  2. Si no existe, aplica el límite global por usuario (`UserRestrictionLimit.userGlobalLimit`).
  3. Si no existe, aplica el límite general del sistema (`SystemSetting` - `globalLimit`).
- Límite de venta total en el sorteo:
  - Si un usuario tiene un límite de venta por sorteo (`UserRestrictionLimit.userDrawSaleLimit`), se valida que la suma de todos sus tickets activos en ese sorteo más el actual no supere dicho límite.
- Cancelación de ticket bloqueada si:
  - Ya fue cancelado.
  - Sorteo cerrado o con número ganador ya definido.
- `customerName` se permite vacío en backend (actualmente opcional de facto).

## 8) Flujo Android de autenticación y token refresh
- Tokens guardados en `TokenDataStore` (DataStore Preferences).
- Se mantiene caché en memoria para evitar bloqueos en interceptor.
- `AuthInterceptor` agrega `Authorization: Bearer ...`.
- `TokenAuthenticator` intenta refresh ante 401:
  - Usa refresh token cacheado.
  - Si refresh funciona, actualiza tokens y reintenta request.
  - Si refresh falla, limpia sesión.
- Se agrega el header `X-Retry-Auth` para evitar loops infinitos de reintento ante fallos recurrentes de refresh token.

## 9) Cola offline en Android
- Si no hay red al vender, se encola venta en Room (`pending_sales`).
- `SyncWorker` (WorkManager) sincroniza cuando vuelve conectividad.
- Política de reintentos:
  - Errores de red/servidor (5xx, timeouts) son reintentables.
  - Errores de negocio (4xx) no deben ciclar indefinidamente; se marca el fallo como definitivo al superar el umbral de reintentos.

## 10) Configuración de API base URL en Android
Ubicación principal:
- `android-native/app/build.gradle.kts`
  - `buildConfigField("String", "API_BASE_URL", "\"http://192.168.0.112:4000\"")`

Normalización de slash final:
- `AppModule` agrega `/` al final si falta.

Para pruebas en dispositivo físico:
- Usar la IP LAN del equipo donde corre el backend (no `localhost` del móvil).

## 11) Brechas actuales entre backend y Android (importante)

### 11.1 Endpoint top-numbers: desalineación de DTO
- Backend en `GET /api/reports/top-numbers` devuelve objetos con:
  - `number`
  - `total`
- Android espera DTO con:
  - `number`
  - `totalAmount`
  - `ticketCount`
- **Riesgo**: Parseo incompleto o valores en cero/null según la versión del mapper Android.

### 11.2 Cobertura de API en Android es parcial
Android no consume aún varios módulos backend:
- `/api/users`
- `/api/plans`
- `/api/roles`
- `/api/payments`
- `/api/cash-movements`
- `/api/announcements`
- `/api/number-restrictions`
- `/api/special-multipliers`
- `/api/frontend-settings`

## 12) Mapa rápido de archivos importantes

Backend:
- `server/src/index.ts` (registro de rutas)
- `server/src/routes/auth.ts`
- `server/src/routes/tickets.ts`
- `server/src/routes/draws.ts`
- `server/src/routes/reports.ts`
- `server/src/routes/payments.ts`
- `server/src/routes/cashMovements.ts`
- `server/src/routes/numberRestrictions.ts`
- `server/src/routes/frontendSettings.ts`
- `server/src/routes/printBridge.ts`
- `server/prisma/schema.prisma`

Android networking/data:
- `android-native/core/core-network/src/main/java/com/gameover/android/core/network/di/NetworkModule.kt`
- `android-native/core/core-network/src/main/java/com/gameover/android/core/network/api/*.kt`
- `android-native/core/core-network/src/main/java/com/gameover/android/core/network/dto/*.kt`
- `android-native/core/core-network/src/main/java/com/gameover/android/core/network/interceptor/*.kt`
- `android-native/core/core-data/src/main/java/com/gameover/android/core/data/local/TokenDataStore.kt`
- `android-native/core/core-data/src/main/java/com/gameover/android/core/data/repository/*.kt`
- `android-native/core/core-data/src/main/java/com/gameover/android/core/data/di/*.kt`
- `android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/worker/SyncWorker.kt`

## 13) Estado técnico conocido del repo (referencia)
- Hay antecedentes de estado Prisma inconsistente en backend (build global puede fallar por divergencias no relacionadas a Android).
- Antes de atribuir un fallo a Android, validar estado de `server` y Prisma client.

## 14) Checklist para otra IA antes de tocar código Android
1. Confirmar que backend corre y responde `GET /health`.
2. Confirmar `API_BASE_URL` en Android apuntando al backend correcto.
3. Validar login y refresh token.
4. Verificar permisos RBAC del usuario de prueba para el flujo que se está probando.
5. Revisar contratos DTO vs respuesta real (especialmente reportes).
6. Si hay problemas de ventas, revisar reglas de horario y restricciones por número.
7. Si hay problemas intermitentes de red, revisar cola offline + `SyncWorker`.

## 15) Prompt sugerido para una IA nueva
"Analiza primero contratos reales entre `server/src/routes/*.ts` y DTOs en `android-native/core/core-network/dto/*.kt`. Reporta desalineaciones y propone patch mínimo para mantener compatibilidad sin romper flujos actuales de login, ventas, tickets y dashboard."
