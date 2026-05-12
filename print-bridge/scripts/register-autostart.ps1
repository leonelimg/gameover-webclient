$appName = "GameOver Print Bridge"
$exePath = "$env:LOCALAPPDATA\Programs\gameover-print-bridge\GameOver Print Bridge.exe"
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

if (!(Test-Path $exePath)) {
  Write-Error "Executable not found: $exePath"
  exit 1
}

Set-ItemProperty -Path $runKeyPath -Name $appName -Value "`"$exePath`""
Write-Output "Autostart configured for $appName"
