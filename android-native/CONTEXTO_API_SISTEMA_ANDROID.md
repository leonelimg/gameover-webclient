# Contexto API y Sistema para Android (GameOver)

## 1) Objetivo de este documento
Este archivo resume el contexto tecnico minimo y practico para que otra IA pueda trabajar rapido sobre el proyecto Android sin romper contratos con el backend.

Incluye:
- Arquitectura general del sistema.
- Contratos API reales (segun codigo backend y cliente Android).
- Flujo de autenticacion y refresh de token.
- Reglas de negocio criticas (tickets, sorteos, permisos).
- Mapeo de lo que Android ya consume y lo que aun no consume.
- Riesgos actuales conocidos.

## 2) Arquitectura general
- Frontend web: React + Vite en la raiz del repo.
- Backend API: Node.js + Express + Prisma en carpeta `server`.
- Android nativo: proyecto multi-modulo en `android-native`.
- Impresion Windows bridge: servicio `print-bridge` (no usado por Android para imprimir; Android usa Bluetooth nativo ESC/POS).

Arquitectura Android (resumen):
- `app`: arranque, navegacion, DI principal y `API_BASE_URL`.
- `core/core-network`: Retrofit, OkHttp, interceptores, DTOs, APIs.
- `core/core-data`: repositorios, DataStore de tokens, Room (cola offline).
- `core/core-domain`: modelos y casos de uso.
- `feature-*`: pantallas y ViewModels (auth, dashboard, sales, tickets, settings, bluetooth).

## 3) Backend API base y seguridad
- Base local por defecto backend: `http://localhost:4000`.
- Health check: `GET /health`.
- Rutas API prefijadas con `/api/...`.
- CORS, Helmet, rate limit y JWT habilitados en backend.

Rate limits relevantes:
- Auth (`/api/auth/*`): limite mas estricto (20 req / 15 min).
- Resto de API: limite general (200 req / min).

Auth:
- Access token corto.
- Refresh token rotativo persistido en DB (`refresh_tokens`).

## 4) Modelo de negocio clave (backend)
Entidades principales:
- `users`, `plans`, `draws`, `restricted_numbers`, `tickets`, `ticket_lines`, `role_permissions`, `system_settings`.

Enums clave:
- Rol usuario: `admin`, `asociado`, `vendedor`.
- Estado usuario: `activo`, `bloqueado`, `archivado`.
- Estado sorteo: `pendiente`, `abierto`, `cerrado`, `finalizado`.
- Estado pago ticket: `pendiente`, `pagado`.

## 5) RBAC (permisos)
El backend usa permisos por recurso/accion (granular), no solo por rol fijo.

Ejemplos de resource keys:
- `/sales`, `/sales:create`, `/sales:cancel`
- `/draws`, `/draws:create`, `/draws:update`, `/draws:delete`
- `/ticket-payments:*`
- `/reports/*`

Implicacion para Android:
- Un 403 casi siempre indica falta de permiso RBAC para ese endpoint/recurso.
- No asumir que por rol ya se tiene acceso a todas las acciones de una pantalla.

## 6) Catalogo de endpoints y campos
Esta es la seccion que otra IA necesita leer primero. Resume metodo, entrada y salida de cada endpoint relevante.

### 6.1 AuthApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `POST /api/auth/login` | `username`, `password` | `accessToken`, `refreshToken`, `user` | `user` incluye `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt` |
| `POST /api/auth/refresh` | `refreshToken` | `accessToken`, `refreshToken` | El refresh rota el token viejo |
| `POST /api/auth/logout` | Sin body | `{ message }` | Borra refresh tokens del usuario |
| `GET /api/auth/me` | Sin body | `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt` | Requiere token valido |

### 6.2 DrawsApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/draws` | Sin body | Lista de sorteos con `id`, `name`, `closeTime`, `minutosPreviosCierre`, `winnerNumber`, `status`, `restrictedNumbers`, `specialMultiplier`, `createdAt` | Android lo usa para seleccionar sorteos abiertos |
| `GET /api/draws/search` | Query: `fromDate`, `toDate`, `page`, `pageSize` | `{ items, total, page, pageSize, totalPages }` | `items` tiene la misma forma que `GET /api/draws` |
| `GET /api/draws/:id` | Param `id` | Un sorteo completo | Incluye restricciones y multiplicador especial |
| `POST /api/draws` | `name`, `closeTime`, `minutosPreviosCierre`, `winnerNumber?`, `specialMultiplierId?` | Sorteo creado | `closeTime` debe ser ISO datetime |
| `PATCH /api/draws/:id` | Campos parciales del sorteo | Sorteo actualizado | Recalcula `status` segun horario y ganador |
| `DELETE /api/draws/:id` | Param `id` | 204 sin body | Elimina el sorteo |
| `POST /api/draws/:id/restricted-numbers` | `number`, `limit` | `id`, `number`, `limit`, `drawId`, `createdAt`, `updatedAt` | Upsert por `drawId + number` |
| `DELETE /api/draws/:id/restricted-numbers/:number` | Param `id`, param `number` | 204 sin body | Borra una restriccion puntual |

### 6.3 TicketsApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/tickets` | Query opcional: `drawId`, `sellerId`, `associateId`, `code`, `includeCanceled` | Lista de tickets | Cada ticket trae `id`, `code`, `drawId`, `sellerId`, `associateId`, `customerName`, `lines`, `total`, `createdAt`, `printedAt`, `paymentStatus`, `paidAt`, `canceledAt`, `canceledById`, `cancelReason`, `draw`, `seller`, `associate` |
| `GET /api/tickets/:id` | Param `id` | Ticket completo | `draw` incluye `closeTime` y `minutosPreviosCierre`; `seller` y `associate` incluyen datos resumen |
| `POST /api/tickets` | `drawId`, `customerName`, `lines[]` | Ticket creado | Cada linea: `number`, `amount`, `isNicaEspecial`; backend ignora `specialAmount` en persistencia actual y usa solo `number`, `amount`, `isNicaEspecial` |
| `PATCH /api/tickets/:id/print` | Param `id` | Ticket actualizado | Marca `printedAt` |
| `PATCH /api/tickets/:id/cancel` | Param `id`, body `reason?` | Ticket actualizado | Marca `canceledAt`, `canceledById`, `cancelReason` |

Campos de `TicketDto` que Android ya mapea:
- Ticket: `id`, `code`, `drawId`, `sellerId`, `associateId`, `customerName`, `lines`, `total`, `createdAt`, `printedAt`, `paymentStatus`, `paidAt`, `canceledAt`, `canceledById`, `cancelReason`.
- `lines[]`: `number`, `amount`, `specialAmount?`, `isNicaEspecial`.
- `draw?`: `id`, `name`, `specialMultiplier?`.
- `seller?` y `associate?`: `id`, `fullName`, `username`.

### 6.4 ReportsApi

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/reports/summary` | Query opcional: `drawId`, `fromDate`, `toDate` | `totalSales`, `ticketCount`, `drawCount`, `userCount`, `totalPrizes`, `totalCommissions` | Resumen general de ventas |
| `GET /api/reports/top-numbers` | Query: `drawId`, `limit?`, `fromDate?`, `toDate?` | Backend devuelve `number` y `total` | Android hoy espera `totalAmount` y `ticketCount`; hay desalineacion |
| `GET /api/reports/recent-tickets` | Query `limit?` | Lista de tickets recientes | Android lo usa para dashboard |
| `GET /api/reports/hierarchy` | Query opcional: `drawId`, `fromDate`, `toDate` | Arbol de usuarios con ventas acumuladas | Solo para permisos de reportes |
| `GET /api/reports/balance-breakdown` | Query dependiente del modulo | Desglose financiero | Relevante para web, no para Android aun |
| `GET /api/reports/sales-by-user` | Query dependiente del modulo | Ventas por usuario | Relevante para web y permisos granulares |
| `GET /api/reports/draw-lists` | Query dependiente del modulo | Listados por sorteo | Relevante para web |
| `GET /api/reports/commissions` | Query dependiente del modulo | Comisiones | Relevante para web |

### 6.5 Plans

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/plans` | Sin body | Lista de planes | Cada plan trae `id`, `name`, `multiplier`, `commission`, `createdAt`, `updatedAt`, `masterId`, `master` |
| `GET /api/plans/:id` | Param `id` | Un plan | `master` solo expone `id` y `fullName` |
| `POST /api/plans` | `name`, `multiplier`, `commission`, `masterId?` | Plan creado | `commission` es porcentaje de 0 a 100 |
| `PATCH /api/plans/:id` | Campos parciales | Plan actualizado | Campos opcionales |
| `DELETE /api/plans/:id` | Param `id` | 204 sin body | Elimina el plan |

### 6.6 Users

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/users` | Query opcional: `role`, `status`, `search` | Lista de usuarios | Devuelve `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt` |
| `GET /api/users/:id` | Param `id` | Un usuario | Misma forma que arriba |
| `POST /api/users` | `fullName`, `username`, `email`, `phone?`, `role`, `password`, `planId?`, `parentId?` | Usuario creado | `password` se hashea en backend |
| `PATCH /api/users/:id` | Campos parciales: `fullName`, `email`, `phone`, `role`, `planId`, `parentId` | Usuario actualizado | `planId` y `parentId` pueden ser `null` |
| `PATCH /api/users/:id/password` | `password` | `{ message }` | Cambia contraseña |
| `PATCH /api/users/:id/status` | `status` | Usuario actualizado | `status` valido: `activo`, `bloqueado`, `archivado` |

### 6.7 Ticket payments

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/payments/winning-tickets` | Query: `drawId`, `status?`, `code?` | `{ draw, tickets, paidTickets, totals }` | `draw` trae `id`, `name`, `winnerNumber`, `hasWinnerNumber` |
| `PATCH /api/payments/mark-paid` | `ticketId?` o `code?` | `{ ticket, prizeAmount }` | Marca `paymentStatus = pagado` |
| `PATCH /api/payments/:id/revert` | Param `id` | Ticket actualizado | Revierte a `pendiente` |

Estructura resumida de `tickets` en pagos:
- `ticketId`, `code`, `customerName`, `seller`, `createdAt`, `paymentStatus`, `paidAt`, `paidBy`, `winningNumbers`, `prizeAmount`.

### 6.8 Cash movements

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/cash-movements/targets` | Sin body | Lista de usuarios objetivo | Cada item: `id`, `fullName`, `username`, `role`, `status`, `canOperate` |
| `GET /api/cash-movements` | Query: `targetUserId?`, `type?`, `fromDate?`, `toDate?`, `limit?` | Lista de movimientos | Cada movimiento incluye `id`, `targetUserId`, `createdById`, `type`, `amount`, `note`, `createdAt`, `canceledAt`, `canceledById`, `createdBy`, `targetUser`, `source`, `referenceCode?` |
| `GET /api/cash-movements/balance` | Query: `targetUserId?`, `fromDate?`, `toDate?` | `{ balance, deposits, withdrawals, sales }` | Resumen de caja |
| `POST /api/cash-movements` | `targetUserId`, `type`, `amount`, `note?` | Movimiento creado | `type`: `deposito` o `retiro` |
| `PATCH /api/cash-movements/:id/cancel` | Param `id`, `reason?` | Movimiento actualizado | Cancela movimiento |

### 6.9 Announcements

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/announcements/active` | Sin body | Lista de anuncios activos | Cada anuncio trae `id`, `name`, `message`, `imageUrl`, `startDate`, `endDate`, `createdAt`, `updatedAt`, `createdBy` |
| `GET /api/announcements` | Sin body | Lista completa | Para administradores |
| `POST /api/announcements/:id/dismiss` | Param `id` | 204 sin body | Registra dismissal del usuario |
| `POST /api/announcements` | multipart form-data: `name`, `message?`, `startDate`, `endDate`, `image?` | Anuncio creado | `image` debe ser archivo de imagen |
| `PATCH /api/announcements/:id` | multipart form-data parcial + `clearImage?` | Anuncio actualizado | Si cambia imagen, borra la anterior |
| `DELETE /api/announcements/:id` | Param `id` | 204 sin body | Elimina anuncio |

### 6.10 Roles y permisos

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/roles/my-permissions` | Sin body | `{ permissions: string[] }` | Lista de resource keys permitidas para el usuario |
| `GET /api/roles/permissions` | Sin body | `{ permissions: [{ resourceKey, label, admin, asociado, vendedor }] }` | Matriz de permisos |
| `PATCH /api/roles/permissions` | `{ permissions: [{ resourceKey, asociado, vendedor }] }` | `{ message }` o 204 | Valida `resourceKey` contra recursos conocidos |

### 6.11 Special multipliers

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/special-multipliers` | Sin body | Lista de items | Cada item: `id`, `name`, `value`, `createdAt`, `updatedAt` |
| `GET /api/special-multipliers/:id` | Param `id` | Un item | 404 si no existe |
| `POST /api/special-multipliers` | `name`, `value` | Item creado | `value` entero de 1 a 10 |
| `PATCH /api/special-multipliers/:id` | Campos parciales | Item actualizado | |
| `DELETE /api/special-multipliers/:id` | Param `id` | 204 sin body | |

### 6.12 Number restrictions

| Endpoint | Request | Response / campos principales | Notas |
|---|---|---|---|
| `GET /api/number-restrictions/global` | Sin body | `{ globalLimit }` | `globalLimit` puede ser `null` |
| `PATCH /api/number-restrictions/global` | `{ globalLimit }` | `{ globalLimit }` | Actualiza limite global de numeros |

## 6.13 DTOs Android mas importantes
- `LoginResponse`: `accessToken`, `refreshToken`, `user`.
- `UserDto`: `id`, `fullName`, `username`, `email`, `phone`, `role`, `status`, `planId`, `parentId`, `createdAt`, `updatedAt`.
- `DrawDto`: `id`, `name`, `closeTime`, `minutosPreviosCierre`, `winnerNumber`, `status`, `restrictedNumbers`, `specialMultiplier`, `createdAt`.
- `TicketDto`: `id`, `code`, `drawId`, `sellerId`, `associateId`, `customerName`, `lines`, `total`, `createdAt`, `printedAt`, `paymentStatus`, `paidAt`, `canceledAt`, `canceledById`, `cancelReason`, `draw`, `seller`, `associate`.
- `ReportSummaryDto`: `totalSales`, `ticketCount`, `drawCount`, `userCount`, `totalPrizes`, `totalCommissions`.
- `TopNumberDto`: Android espera `number`, `totalAmount`, `ticketCount`, pero el backend actual responde con una forma distinta.

## 7) Reglas de negocio criticas para tickets/sales
- El numero de apuesta debe ser exactamente 2 digitos (`^\\d{2}$`).
- Debe haber al menos una linea en el ticket.
- No se puede vender si el sorteo esta fuera de horario (cutoff por `closeTime - minutosPreviosCierre`).
- Restricciones por numero:
  - Primero aplica restriccion individual del sorteo.
  - Si no existe, aplica limite global (`system_settings`).
- Cancelacion de ticket bloqueada si:
  - Ya fue cancelado.
  - Sorteo cerrado o con numero ganador ya definido.
- `customerName` se permite vacio en backend (actualmente opcional de facto).

## 8) Flujo Android de autenticacion y token refresh
- Tokens guardados en `TokenDataStore` (DataStore Preferences).
- Se mantiene cache en memoria para evitar bloqueos en interceptor.
- `AuthInterceptor` agrega `Authorization: Bearer ...`.
- `TokenAuthenticator` intenta refresh ante 401:
  - Usa refresh token cacheado.
  - Si refresh funciona, actualiza tokens y reintenta request.
  - Si refresh falla, limpia sesion.

Notas:
- Se agrega header `X-Retry-Auth` para evitar loops infinitos de reintento.

## 9) Cola offline en Android
- Si no hay red al vender, se encola venta en Room (`pending_sales`).
- `SyncWorker` (WorkManager) sincroniza cuando vuelve conectividad.
- Politica de reintentos:
  - Errores de red/servidor reintentables.
  - Errores de negocio (4xx) no deben ciclar indefinidamente.
  - Marca fallo definitivo al superar umbral de reintentos.

## 10) Configuracion de API base URL en Android
Ubicacion principal:
- `android-native/app/build.gradle.kts`
  - `buildConfigField("String", "API_BASE_URL", "\"http://192.168.0.112:4000\"")`

Normalizacion de slash final:
- `AppModule` agrega `/` al final si falta.

Para pruebas en dispositivo fisico:
- Usar IP LAN del equipo donde corre backend (no `localhost` del movil).

## 11) Brechas actuales entre backend y Android (importante)

### 11.1 Endpoint top-numbers: posible desalineacion de DTO
- Backend en `GET /api/reports/top-numbers` devuelve objetos con:
  - `number`
  - `total`
- Android espera DTO con:
  - `number`
  - `totalAmount`
  - `ticketCount`

Riesgo:
- Parseo incompleto o valores en cero/null segun adaptacion actual.

Recomendacion:
- Alinear contrato en backend o ajustar DTO/mapper Android para aceptar respuesta real.

### 11.2 Cobertura de API en Android es parcial
Android no consume aun varios modulos backend:
- `/api/users`
- `/api/plans`
- `/api/roles`
- `/api/payments`
- `/api/cash-movements`
- `/api/announcements`
- `/api/number-restrictions`
- `/api/special-multipliers` (parcialmente depende de draws)

## 12) Mapa rapido de archivos importantes

Backend:
- `server/src/index.ts` (registro de rutas)
- `server/src/routes/auth.ts`
- `server/src/routes/tickets.ts`
- `server/src/routes/draws.ts`
- `server/src/routes/reports.ts`
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

## 13) Estado tecnico conocido del repo (referencia)
- Hay antecedentes de estado Prisma inconsistente en backend (build global puede fallar por divergencias no relacionadas a Android).
- Antes de atribuir un fallo a Android, validar estado de `server` y Prisma client.

## 14) Checklist para otra IA antes de tocar codigo Android
1. Confirmar que backend corre y responde `GET /health`.
2. Confirmar `API_BASE_URL` en Android apuntando al backend correcto.
3. Validar login y refresh token.
4. Verificar permisos RBAC del usuario de prueba para el flujo que se esta probando.
5. Revisar contratos DTO vs respuesta real (especialmente reportes).
6. Si hay problemas de ventas, revisar reglas de horario y restricciones por numero.
7. Si hay problemas intermitentes de red, revisar cola offline + `SyncWorker`.

## 15) Prompt sugerido para una IA nueva
"Analiza primero contratos reales entre `server/src/routes/*.ts` y DTOs en `android-native/core/core-network/dto/*.kt`. Reporta desalineaciones y propone patch minimo para mantener compatibilidad sin romper flujos actuales de login, ventas, tickets y dashboard."
