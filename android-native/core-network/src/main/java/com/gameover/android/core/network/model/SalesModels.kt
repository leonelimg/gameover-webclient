package com.gameover.android.core.network.model

data class DrawDto(
    val id: String,
    val name: String,
    val closeTime: String,
    val minutosPreviosCierre: Int,
    val status: String,
    val winnerNumber: String?,
    val restrictedNumbers: List<RestrictedNumberDto>
)

data class RestrictedNumberDto(val number: String, val limit: Double)

data class CreateTicketRequest(
    val drawId: String,
    val customerName: String,
    val lines: List<TicketLineRequest>
)

data class TicketLineRequest(
    val number: String,
    val amount: Double,
    val specialAmount: Double?,
    val isNicaEspecial: Boolean = false
)
