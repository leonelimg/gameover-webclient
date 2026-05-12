# GameOver Print Bridge

Servicio local para impresion de tickets por ESC/POS usando puerto serial COM (incluye impresoras Bluetooth emparejadas en Windows).

## Fases implementadas

### Fase 1
- Bridge local HTTP en localhost
- `POST /test-print`
- `POST /print-text`

### Fase 2
- Ticket ESC/POS real con:
  - negrita
  - alineacion izquierda/centro/derecha
  - QR
  - corte de papel
- Endpoint `POST /print-ticket`

### Fase 3
- Cola persistente en disco (`data/queue.json`)
- Reintentos con backoff exponencial
- Monitor de estado:
  - `GET /health`
  - `GET /jobs`
  - `GET /jobs/:id`
  - `POST /jobs/:id/retry`

### Fase 4
- Shell Electron para distribucion en Windows
- NSIS installer con `electron-builder`
- Auto-start con Windows login
- Auto-update con `electron-updater`

## Requisitos

1. Emparejar la impresora Bluetooth en Windows.
2. Identificar el puerto COM asignado (por ejemplo COM5).
3. Configurar `.env` con `PRINTER_SERIAL_PORT` y `PRINTER_SERIAL_BAUD`.

## Configuracion

```bash
cp .env.example .env
```

Valores importantes:
- `PRINTBRIDGE_PORT=17890`
- `PRINTBRIDGE_HOST=127.0.0.1`
- `PRINTBRIDGE_TOKEN=change-me`
- `PRINTER_SERIAL_PORT=COM5`
- `PRINTER_SERIAL_BAUD=9600`

## Desarrollo

```bash
npm install
npm run dev
```

## Build bridge (servicio)

```bash
npm run build:bridge
npm run start
```

## Build instalador Windows

```bash
npm run dist:win

## version portable
cd print-bridge
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"; npm run dist:portable
```

## Endpoint examples

### Health
```bash
curl -H "Authorization: Bearer change-me" http://127.0.0.1:17890/health
```

### Test print
```bash
curl -X POST http://127.0.0.1:17890/test-print \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me" \
  -d "{\"message\":\"Prueba GameOver\"}"
```

### Print ticket
```bash
curl -X POST http://127.0.0.1:17890/print-ticket \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me" \
  -d "{\"ticket\":{\"title\":\"Ticket\",\"items\":[{\"label\":\"Sorteo Noche\",\"qty\":1,\"unitPrice\":100,\"total\":100}],\"totals\":{\"total\":100},\"qrText\":\"TCK-001\"}}"
```

## Integracion frontend

Cliente listo en `src/services/printBridge.ts`.
Se usa desde `src/pages/Sales/SalesPage.tsx` con el boton "Imprimir nativo".
