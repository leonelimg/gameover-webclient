# GameOver Android Native (WIP)

Proyecto Android nativo multi-módulo con Kotlin + MVVM + Room, alineado con reglas de negocio del sistema actual.

## Módulos

- `app`
- `core-common`
- `core-network`
- `core-database`
- `core-bluetooth`
- `core-print`
- `feature-login`
- `feature-dashboard`
- `feature-sales`
- `feature-tickets`
- `feature-reports`

## Alcance aplicado

- Android 8+ (`minSdk 26`)
- Misma lógica de ticket/impresión (incluye QR y corte ESC/POS)
- Tickets ganadores: solo reporte (sin pagar/revertir)
- Comisiones: solo lectura
- Offline básico con cola para registrar ventas cuando no hay conexión
- Permisos alineados por `resourceKey` del backend
- Contrato para búsqueda por cámara de código de ticket

## Configuración API base URL

- Debug por defecto: `http://10.0.2.2:4000`.
- Release por defecto: `https://api.gameover.local`.
- Puede sobreescribirse con propiedad Gradle:
  - `./gradlew assembleDebug -PGO_API_BASE_URL=https://tu-api`
  - `./gradlew assembleRelease -PGO_API_BASE_URL_RELEASE=https://tu-api`
