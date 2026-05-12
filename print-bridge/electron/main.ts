import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import log from "electron-log";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

let tray: Tray | null = null;
let bridgeProc: ChildProcessWithoutNullStreams | null = null;
let settingsWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let bridgeRestartTimer: NodeJS.Timeout | null = null;
let bridgeInitialStartTimer: NodeJS.Timeout | null = null;

interface BridgeSettings {
  port: number;
  host: string;
  token: string;
  allowedOrigins: string;
  serialPort: string;
  serialBaud: number;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

const defaultSettings = (): BridgeSettings => ({
  port: Number(process.env.PRINTBRIDGE_PORT ?? 17890),
  host: process.env.PRINTBRIDGE_HOST ?? "127.0.0.1",
  token: process.env.PRINTBRIDGE_TOKEN ?? "",
  allowedOrigins: process.env.PRINTBRIDGE_ALLOWED_ORIGINS ?? "http://localhost:5173",
  serialPort: process.env.PRINTER_SERIAL_PORT ?? "COM5",
  serialBaud: Number(process.env.PRINTER_SERIAL_BAUD ?? 9600)
});

let currentSettings: BridgeSettings = defaultSettings();

const getSettingsPath = () => path.join(app.getPath("userData"), "bridge-settings.json");
const getBridgeDataDir = () => path.join(app.getPath("userData"), "data");

const sanitizeSettings = (raw: Partial<BridgeSettings>): BridgeSettings => {
  const defaults = defaultSettings();
  const port = Number(raw.port ?? defaults.port);
  const serialBaud = Number(raw.serialBaud ?? defaults.serialBaud);

  return {
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? port : defaults.port,
    host: String(raw.host ?? defaults.host).trim() || defaults.host,
    token: String(raw.token ?? defaults.token),
    allowedOrigins: String(raw.allowedOrigins ?? defaults.allowedOrigins).trim() || defaults.allowedOrigins,
    serialPort: String(raw.serialPort ?? defaults.serialPort).trim() || defaults.serialPort,
    serialBaud: Number.isFinite(serialBaud) && serialBaud > 0 ? serialBaud : defaults.serialBaud
  };
};

const loadSettings = (): BridgeSettings => {
  const settingsPath = getSettingsPath();
  try {
    if (!fs.existsSync(settingsPath)) {
      return defaultSettings();
    }

    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BridgeSettings>;
    return sanitizeSettings(parsed);
  } catch (error) {
    log.error("Failed to load bridge settings", error);
    return defaultSettings();
  }
};

const saveSettings = (settings: BridgeSettings) => {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const createTrayIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#0f766e"/>
      <rect x="16" y="14" width="32" height="18" rx="3" fill="#ffffff"/>
      <rect x="14" y="28" width="36" height="18" rx="4" fill="#e2e8f0"/>
      <rect x="20" y="36" width="24" height="14" rx="2" fill="#ffffff"/>
      <circle cx="42" cy="21" r="2.2" fill="#0f766e"/>
    </svg>`;

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
};

const buildMainHtml = (settings: BridgeSettings) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GameOver Print Bridge</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: linear-gradient(180deg, #e0f2fe, #f8fafc); color: #0f172a; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 28px; }
    .card { background: rgba(255,255,255,0.94); border: 1px solid #dbe4f0; border-radius: 16px; padding: 22px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08); }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { color: #475569; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 22px; }
    .panel { border: 1px solid #dbe4f0; border-radius: 12px; padding: 16px; background: #fff; }
    .label { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .value { font-size: 16px; font-weight: 700; }
    .actions { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
    button { border: 0; border-radius: 10px; padding: 12px 16px; font-size: 14px; cursor: pointer; }
    .primary { background: #0f766e; color: white; }
    .secondary { background: #e2e8f0; color: #0f172a; }
    .muted { margin-top: 18px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>GameOver Print Bridge</h1>
      <p>Servicio local de impresion. Desde aqui puedes abrir el estado del bridge o cambiar la configuracion de esta PC.</p>

      <div class="grid">
        <div class="panel">
          <div class="label">Puerto</div>
          <div class="value">${settings.port}</div>
        </div>
        <div class="panel">
          <div class="label">Host</div>
          <div class="value">${escapeHtml(settings.host)}</div>
        </div>
        <div class="panel">
          <div class="label">Puerto COM</div>
          <div class="value">${escapeHtml(settings.serialPort)}</div>
        </div>
        <div class="panel">
          <div class="label">Baud Rate</div>
          <div class="value">${settings.serialBaud}</div>
        </div>
      </div>

      <div class="actions">
        <button class="primary" onclick="location.href='gameover-app://settings'">Configuracion</button>
        <button class="secondary" onclick="location.href='gameover-app://health'">Abrir estado del bridge</button>
      </div>

      <div class="muted">Si cierras esta ventana, la app sigue ejecutandose en segundo plano.</div>
    </div>
  </div>
</body>
</html>`;

const buildHealthHtml = (port: number) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Estado - GameOver Print Bridge</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 28px; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 22px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .status { display: inline-flex; align-items: center; gap: 8px; margin-top: 14px; padding: 10px 12px; border-radius: 999px; background: #1f2937; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #f59e0b; }
    .ok .dot { background: #22c55e; }
    .bad .dot { background: #ef4444; }
    .muted { color: #94a3b8; font-size: 13px; margin-top: 12px; }
    pre { margin-top: 18px; padding: 16px; background: #0b1220; border-radius: 12px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
    button { margin-top: 16px; border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer; background: #2563eb; color: white; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Estado del bridge</h1>
      <div id="status" class="status"><span class="dot"></span><span id="statusText">Conectando...</span></div>
      <div class="muted">Puerto local: ${port}</div>
      <pre id="details">Esperando respuesta del bridge...</pre>
      <button onclick="refreshNow()">Reintentar</button>
    </div>
  </div>
  <script>
    const endpoint = 'http://127.0.0.1:${port}/health';
    const statusEl = document.getElementById('status');
    const statusTextEl = document.getElementById('statusText');
    const detailsEl = document.getElementById('details');

    async function refreshNow() {
      try {
        statusEl.className = 'status';
        statusTextEl.textContent = 'Conectando...';
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        statusEl.className = 'status ok';
        statusTextEl.textContent = 'Bridge activo';
        detailsEl.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        statusEl.className = 'status bad';
        statusTextEl.textContent = 'Bridge no disponible';
        detailsEl.textContent = String(error?.message ?? error);
      }
    }

    refreshNow();
    setInterval(refreshNow, 1500);
  </script>
</body>
</html>`;

const openMainWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    title: "GameOver Print Bridge",
    autoHideMenuBar: true,
    skipTaskbar: true,
    show: true
  });

  mainWindow.on("close", (event) => {
    // Tray-first behavior: closing hides the window instead of leaving a taskbar entry.
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url === "gameover-app://settings") {
      event.preventDefault();
      openSettingsWindow();
      return;
    }

    if (url === "gameover-app://health") {
      event.preventDefault();
      openHealthWindow();
    }
  });

  const html = buildMainHtml(currentSettings);
  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
};

const buildSettingsHtml = (settings: BridgeSettings) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Configuracion Print Bridge</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #f3f6fb; color: #0f172a; }
    .wrap { max-width: 620px; margin: 0 auto; padding: 24px; }
    .card { background: #fff; border: 1px solid #dbe4f0; border-radius: 12px; padding: 18px; box-shadow: 0 8px 22px rgba(2, 8, 23, 0.06); }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 16px; color: #475569; }
    label { display: block; margin: 12px 0 6px; font-size: 13px; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .actions { display: flex; gap: 10px; margin-top: 18px; }
    button { border: 0; border-radius: 8px; padding: 10px 14px; font-size: 14px; cursor: pointer; }
    .primary { background: #0f766e; color: #fff; }
    .secondary { background: #e2e8f0; color: #0f172a; }
    .hint { margin-top: 10px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Configuracion local</h1>
      <p>Estos valores se guardan en esta PC y se aplican al reiniciar el servicio interno.</p>
      <form method="GET" action="gameover-config://save">
        <div class="row">
          <div>
            <label for="port">Puerto</label>
            <input id="port" name="port" type="number" min="1" max="65535" required value="${settings.port}" />
          </div>
          <div>
            <label for="host">Host</label>
            <input id="host" name="host" type="text" required value="${escapeHtml(settings.host)}" />
          </div>
        </div>

        <label for="token">Token (opcional)</label>
        <input id="token" name="token" type="text" value="${escapeHtml(settings.token)}" />

        <label for="allowedOrigins">Allowed Origins (coma separados)</label>
        <input id="allowedOrigins" name="allowedOrigins" type="text" value="${escapeHtml(settings.allowedOrigins)}" />

        <div class="row">
          <div>
            <label for="serialPort">Puerto COM</label>
            <input id="serialPort" name="serialPort" type="text" required value="${escapeHtml(settings.serialPort)}" />
          </div>
          <div>
            <label for="serialBaud">Baud Rate</label>
            <input id="serialBaud" name="serialBaud" type="number" min="1" required value="${settings.serialBaud}" />
          </div>
        </div>

        <div class="actions">
          <button class="primary" type="submit">Guardar y reiniciar</button>
          <button class="secondary" type="button" onclick="window.close()">Cancelar</button>
        </div>
        <div class="hint">Archivo de configuracion: ${escapeHtml(getSettingsPath())}</div>
      </form>
    </div>
  </div>
</body>
</html>`;

const openSettingsWindow = () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 680,
    height: 680,
    resizable: true,
    title: "Configuracion - GameOver Print Bridge",
    autoHideMenuBar: true,
    skipTaskbar: true
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  settingsWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("gameover-config://save")) {
      return;
    }

    event.preventDefault();

    try {
      const parsedUrl = new URL(url);
      const updated = sanitizeSettings({
        port: Number(parsedUrl.searchParams.get("port") ?? currentSettings.port),
        host: parsedUrl.searchParams.get("host") ?? currentSettings.host,
        token: parsedUrl.searchParams.get("token") ?? currentSettings.token,
        allowedOrigins: parsedUrl.searchParams.get("allowedOrigins") ?? currentSettings.allowedOrigins,
        serialPort: parsedUrl.searchParams.get("serialPort") ?? currentSettings.serialPort,
        serialBaud: Number(parsedUrl.searchParams.get("serialBaud") ?? currentSettings.serialBaud)
      });

      currentSettings = updated;
      saveSettings(updated);
      log.info("Bridge settings updated", updated);

      void stopBridge().then(() => {
        startBridge();
      });

      settingsWindow?.close();
    } catch (error) {
      log.error("Failed to save settings", error);
    }
  });

  const html = buildSettingsHtml(currentSettings);
  settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
};

const openHealthWindow = () => {
  const healthWindow = new BrowserWindow({
    width: 900,
    height: 640,
    title: "Estado - GameOver Print Bridge",
    autoHideMenuBar: true,
    skipTaskbar: true
  });

  const html = buildHealthHtml(currentSettings.port);
  void healthWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getBridgeEntrypoint = () => {
  const distPath = path.join(__dirname, "..", "dist", "index.js");
  return distPath;
};

const startBridge = () => {
  if (bridgeProc) {
    return;
  }

  if (bridgeRestartTimer) {
    clearTimeout(bridgeRestartTimer);
    bridgeRestartTimer = null;
  }

  const entry = getBridgeEntrypoint();
  if (!fs.existsSync(entry)) {
    log.error(`[bridge] Entrypoint not found: ${entry}`);
    return;
  }

  const dataDir = getBridgeDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  bridgeProc = spawn(process.execPath, [entry], {
    cwd: app.getPath("userData"),
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PRINTBRIDGE_PORT: String(currentSettings.port),
      PRINTBRIDGE_HOST: currentSettings.host,
      PRINTBRIDGE_TOKEN: currentSettings.token,
      PRINTBRIDGE_ALLOWED_ORIGINS: currentSettings.allowedOrigins,
      PRINTBRIDGE_DATA_DIR: dataDir,
      PRINTER_SERIAL_PORT: currentSettings.serialPort,
      PRINTER_SERIAL_BAUD: String(currentSettings.serialBaud)
    }
  });

  bridgeProc.stdout.on("data", (chunk) => {
    log.info(`[bridge] ${chunk.toString().trim()}`);
  });

  bridgeProc.stderr.on("data", (chunk) => {
    log.error(`[bridge] ${chunk.toString().trim()}`);
  });

  bridgeProc.on("exit", (code) => {
    log.warn(`Bridge process exited with code ${code ?? 0}`);
    bridgeProc = null;

    if (!isQuitting) {
      bridgeRestartTimer = setTimeout(() => {
        bridgeRestartTimer = null;
        startBridge();
      }, 2000);
    }
  });
};

const scheduleInitialBridgeStart = () => {
  if (bridgeInitialStartTimer) {
    clearTimeout(bridgeInitialStartTimer);
  }

  bridgeInitialStartTimer = setTimeout(() => {
    bridgeInitialStartTimer = null;
    if (!bridgeProc) {
      startBridge();
    }
  }, 3500);
};

const stopBridge = async () => {
  if (bridgeRestartTimer) {
    clearTimeout(bridgeRestartTimer);
    bridgeRestartTimer = null;
  }

  if (bridgeInitialStartTimer) {
    clearTimeout(bridgeInitialStartTimer);
    bridgeInitialStartTimer = null;
  }

  if (!bridgeProc) {
    return;
  }

  bridgeProc.kill();
  bridgeProc = null;
};

const createTray = () => {
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  tray.setToolTip("GameOver Print Bridge");

  const menu = Menu.buildFromTemplate([
    {
      label: "Mostrar app",
      click: () => {
        openMainWindow();
      }
    },
    {
      label: "Abrir panel local",
      click: () => {
        openHealthWindow();
      }
    },
    {
      label: "Configuracion",
      click: () => {
        openSettingsWindow();
      }
    },
    {
      label: "Buscar actualizaciones",
      click: () => {
        void autoUpdater.checkForUpdates();
      }
    },
    {
      label: "Salir",
      click: async () => {
        await stopBridge();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => {
    openMainWindow();
  });
  tray.on("double-click", () => {
    openMainWindow();
  });
};

const configureUpdater = () => {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false; // No descargar automáticamente
  autoUpdater.autoInstallOnAppQuit = false; // No instalar automaticamente

  autoUpdater.on("update-available", (info) => {
    log.info(`Update available: ${info.version}`);
  });

  autoUpdater.on("update-downloaded", () => {
    log.info("Update downloaded, will install on next restart");
    // NO llamar a quitAndInstall() automáticamente
  });
};

app.setName("GameOver Print Bridge");
app.disableHardwareAcceleration();

app.on("second-instance", () => {
  openMainWindow();
});

app.on("window-all-closed", () => {
  // Keep process alive in tray-only mode.
});

app.whenReady().then(() => {
  currentSettings = loadSettings();

  app.setAppUserModelId("com.gameover.printbridge");

  configureUpdater();
  startBridge();
  scheduleInitialBridgeStart();
  createTray();
  openMainWindow();

  // Deshabilitado: void autoUpdater.checkForUpdatesAndNotify();
});

app.on("before-quit", async (event) => {
  isQuitting = true;
  event.preventDefault();
  await stopBridge();
  process.exit(0);
});
