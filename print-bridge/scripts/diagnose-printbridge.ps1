param(
  [string]$BridgeHost = "127.0.0.1",
  [int]$BridgePort = 17890,
  [switch]$TryStartBridge,
  [switch]$KillBridgePortOwner
)

$ErrorActionPreference = "Stop"

function Read-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Default = ""
  )

  if (!(Test-Path $Path)) {
    return $Default
  }

  $line = Get-Content $Path | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (!$line) {
    return $Default
  }

  return ($line -replace "^$Key=", "")
}

function Try-GetJson {
  param([string]$Uri)

  try {
    return Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec 5
  } catch {
    return $null
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRoot = Split-Path -Parent $scriptDir
$envPath = Join-Path $bridgeRoot ".env"

$configPort = Read-EnvValue -Path $envPath -Key "PRINTBRIDGE_PORT" -Default "$BridgePort"
$configCom = Read-EnvValue -Path $envPath -Key "PRINTER_SERIAL_PORT" -Default "COM5"
$configHost = Read-EnvValue -Path $envPath -Key "PRINTBRIDGE_HOST" -Default $BridgeHost

$BridgeHost = $configHost
$BridgePort = [int]$configPort
$baseUrl = "http://$BridgeHost`:$BridgePort"

Write-Host "== GameOver Print Bridge Diagnostic ==" -ForegroundColor Cyan
Write-Host "Bridge URL: $baseUrl"
Write-Host "Configured COM in .env: $configCom"

if ($KillBridgePortOwner) {
  $owners = Get-NetTCPConnection -LocalAddress $BridgeHost -LocalPort $BridgePort -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($pid in $owners) {
    if ($pid -and $pid -ne 0) {
      Write-Host "Killing process using $BridgeHost`:$BridgePort -> PID $pid" -ForegroundColor Yellow
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
}

$health = Try-GetJson "$baseUrl/health"
if (!$health -and $TryStartBridge) {
  Write-Host "Bridge is down. Starting npm run dev..." -ForegroundColor Yellow
  Push-Location $bridgeRoot
  try {
    Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory $bridgeRoot | Out-Null
  } finally {
    Pop-Location
  }
  Start-Sleep -Seconds 3
  $health = Try-GetJson "$baseUrl/health"
}

if (!$health) {
  Write-Host "Bridge is not reachable at $baseUrl" -ForegroundColor Red
  Write-Host "Tip: run -> cd print-bridge; npm run dev"
  exit 1
}

Write-Host "Bridge status: OK" -ForegroundColor Green
Write-Host ("Queue stats: pending={0}, processing={1}, retrying={2}, failed={3}" -f `
  $health.queue.pending, $health.queue.processing, $health.queue.retrying, $health.queue.failed)

$printers = Try-GetJson "$baseUrl/printers"
if ($printers) {
  Write-Host "Configured transport: $($printers.configured.transport) / $($printers.configured.port) @ $($printers.configured.baudRate)"

  $availableCom = @($printers.available | Where-Object { $_.path -match "^COM\d+$" } | Select-Object -ExpandProperty path)
  if ($availableCom.Count -gt 0) {
    Write-Host "Detected COM ports: $($availableCom -join ", ")"
    $alternatives = @($availableCom | Where-Object { $_ -ne $configCom })
    if ($alternatives.Count -gt 0) {
      Write-Host "Suggested alternate COM: $($alternatives[0])" -ForegroundColor Cyan
    }
  }
}

$testBody = @{ message = "Diagnostic test print $(Get-Date -Format s)" } | ConvertTo-Json -Compress
$test = $null
try {
  $test = Invoke-RestMethod -Uri "$baseUrl/test-print" -Method Post -ContentType "application/json" -Body $testBody -TimeoutSec 5
} catch {
  Write-Host "test-print request failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$jobId = $test.jobId
Write-Host "Created test job: $jobId"

$last = $null
for ($i = 0; $i -lt 6; $i++) {
  Start-Sleep -Seconds 2
  $job = Try-GetJson "$baseUrl/jobs/$jobId"
  if (!$job) { continue }

  $last = $job
  Write-Host ("Job status: {0}, attempts: {1}, lastError: {2}" -f $job.status, $job.attempts, $job.lastError)

  if ($job.status -eq "completed" -or $job.status -eq "failed") {
    break
  }
}

if ($last -and $last.status -eq "retrying" -and $last.lastError -match "Access denied") {
  Write-Host "Serial port access denied. Another process likely owns $configCom." -ForegroundColor Red
  Write-Host "Close vendor software/serial monitors and retry." -ForegroundColor Yellow
}

Write-Host "Diagnostic finished." -ForegroundColor Green
