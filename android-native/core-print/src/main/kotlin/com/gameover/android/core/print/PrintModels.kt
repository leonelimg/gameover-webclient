package com.gameover.android.core.print

data class EscPosTicket(
    val title: String,
    val businessName: String,
    val ticketNumber: String,
    val dateIso: String,
    val cashier: String,
    val drawName: String,
    val detailLines: List<DetailLine>,
    val total: Double,
    val notes: List<String>,
    val qrText: String?
)

data class DetailLine(
    val number: String,
    val regular: Double,
    val special: Double,
    val total: Double
)
