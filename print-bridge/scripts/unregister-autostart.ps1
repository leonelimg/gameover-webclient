$appName = "GameOver Print Bridge"
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

Remove-ItemProperty -Path $runKeyPath -Name $appName -ErrorAction SilentlyContinue
Write-Output "Autostart removed for $appName"
