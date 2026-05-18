package com.gameover.android.app.navigation

sealed class AppDestination(val route: String, val resourceKey: String?) {
    data object Login : AppDestination("login", null)
    data object Dashboard : AppDestination("dashboard", "/dashboard")
    data object Sales : AppDestination("sales", "/sales")
    data object Tickets : AppDestination("tickets", "/reports/sales-by-user")
    data object WinnersReport : AppDestination("winners_report", "/ticket-payments")
    data object CommissionsReport : AppDestination("commissions_report", "/reports/balance-breakdown")
    data object PrintQueue : AppDestination("print_queue", "/print-queue")
}
