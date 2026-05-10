$login = Invoke-RestMethod http://localhost:4000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}'
$token = $login.accessToken
$headers = @{ Authorization = "Bearer $token" }

$tickets = Invoke-RestMethod http://localhost:4000/api/tickets -Headers $headers
$adminTickets = $tickets | Where-Object { $_.seller.username -eq 'admin' }
$adminTicketsSum = ($adminTickets | Measure-Object -Property total -Sum).Sum
$adminTicketsCount = $adminTickets.Count

$report = Invoke-RestMethod http://localhost:4000/api/reports/hierarchy -Headers $headers
# In some cases the report might be the root node itself or an array
if ($report.username -eq 'admin') {
    $adminNode = $report
} else {
    $adminNode = $report | Where-Object { $_.username -eq 'admin' }
}

$reportSales = $adminNode.totalSales
$reportCount = $adminNode.ticketCount

$matchSales = if ([math]::Round($adminTicketsSum, 2) -eq [math]::Round($reportSales, 2)) { "yes" } else { "no" }
$matchCount = if ($adminTicketsCount -eq $reportCount) { "yes" } else { "no" }

[PSCustomObject]@{
    "Admin Sales from /tickets" = $adminTicketsSum
    "Admin Sales in Hierarchy"  = $reportSales
    "Match Sales"              = $matchSales
    "Admin Tickets Count"       = $adminTicketsCount
    "Hierarchy TicketCount"      = $reportCount
    "Match Count"               = $matchCount
} | Format-Table
