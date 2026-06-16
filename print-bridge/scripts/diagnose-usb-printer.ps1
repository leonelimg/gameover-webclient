<#
.SYNOPSIS
    Diagnoses USB printer connectivity for GameOver Print Bridge.
    Helps determine which PRINTER_TRANSPORT and port/name to configure.
#>

Write-Host ""
Write-Host "=== GameOver Print Bridge — USB Printer Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Virtual COM ports ────────────────────────────────────────────────────
Write-Host "1. Virtual COM ports (serialport transport)" -ForegroundColor Yellow
$comPorts = Get-WmiObject Win32_PnPEntity |
    Where-Object { $_.Name -match "COM\d+" } |
    Select-Object Name, DeviceID
if ($comPorts) {
    $comPorts | ForEach-Object {
        $comMatch = $_.Name -match "\(COM(\d+)\)"
        $port = if ($comMatch) { "COM$($Matches[1])" } else { "?" }
        Write-Host "  [$port]  $($_.Name)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  → If your printer is listed above, use:" -ForegroundColor White
    Write-Host "      PRINTER_TRANSPORT=serial" -ForegroundColor White
    Write-Host "      PRINTER_SERIAL_PORT=COMx   (replace x with the number)" -ForegroundColor White
} else {
    Write-Host "  (none found)" -ForegroundColor DarkGray
}

Write-Host ""

# ── 2. USB printer device paths ────────────────────────────────────────────
Write-Host "2. USB printer device paths (rawfile transport)" -ForegroundColor Yellow
$usbPaths = @()
for ($i = 1; $i -le 8; $i++) {
    $path = "\\.\USB00$i"
    try {
        $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write)
        $stream.Close()
        $usbPaths += $path
        Write-Host "  [OK]  $path" -ForegroundColor Green
    } catch {
        # not accessible / not present
    }
}
if ($usbPaths.Count -eq 0) {
    Write-Host "  (none accessible — driver may not expose a raw device path)" -ForegroundColor DarkGray
} else {
    Write-Host ""
    Write-Host "  → Use the path shown above:" -ForegroundColor White
    Write-Host "      PRINTER_TRANSPORT=rawfile" -ForegroundColor White
    Write-Host "      PRINTER_RAW_PATH=\\.\USB001   (adjust number)" -ForegroundColor White
}

Write-Host ""

# ── 3. Windows printers (winspooler transport) ─────────────────────────────
Write-Host "3. Windows printers (winspooler transport)" -ForegroundColor Yellow
$printers = Get-WmiObject Win32_Printer | Select-Object Name, PortName, DriverName
if ($printers) {
    $printers | ForEach-Object {
        Write-Host "  Name     : $($_.Name)" -ForegroundColor Green
        Write-Host "  Port     : $($_.PortName)"
        Write-Host "  Driver   : $($_.DriverName)"
        Write-Host ""
    }
    Write-Host "  → To use a printer from the list above:" -ForegroundColor White
    Write-Host "      PRINTER_TRANSPORT=winspooler" -ForegroundColor White
    Write-Host "      PRINTER_WINDOWS_NAME=<exact Name from above>" -ForegroundColor White
} else {
    Write-Host "  (no Windows printers found)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Edit the .env file in the print-bridge folder and set the variables above."
Write-Host "Then restart Print Bridge."
Write-Host ""
