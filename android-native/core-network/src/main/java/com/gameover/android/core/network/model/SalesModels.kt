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

data class DrawTicketDetailDto(
    val id: String,
    val name: String,
    val winnerNumber: String? = null,
    val closeTime: String? = null,
    val minutosPreviosCierre: Int? = null,
    val specialMultiplier: SpecialMultiplierDto? = null
)

data class SpecialMultiplierDto(
    val id: String,
    val name: String,
    val value: Double
)

data class SellerPlanDto(
    val id: String,
    val name: String,
    val multiplier: Double
)

data class SellerDto(
    val id: String,
    val fullName: String,
    val username: String,
    val plan: SellerPlanDto? = null
)

data class AssociateDto(
    val id: String,
    val fullName: String
)

data class TicketLineDto(
    val number: String,
    val amount: Double,
    val specialAmount: Double? = null,
    val isNicaEspecial: Boolean = false
)

data class TicketDto(
    val id: String,
    val code: String,
    val drawId: String,
    val sellerId: String,
    val associateId: String,
    val customerName: String,
    val lines: List<TicketLineDto>,
    val total: Double,
    val createdAt: String,
    val printedAt: String? = null,
    val canceledAt: String? = null,
    val cancelReason: String? = null,
    val draw: DrawTicketDetailDto? = null,
    val seller: SellerDto? = null,
    val associate: AssociateDto? = null
)

data class SalesByUserFiltersDto(
    val drawId: String?,
    val userId: String?,
    val fromDate: String?,
    val toDate: String?
)

data class SalesByUserTotalsDto(
    val ticketCount: Int,
    val activeTicketCount: Int,
    val canceledTicketCount: Int,
    val totalSales: Double
)

data class SalesByUserRowDto(
    val userId: String,
    val fullName: String,
    val username: String,
    val role: String,
    val ticketCount: Int,
    val activeTicketCount: Int,
    val canceledTicketCount: Int,
    val totalSales: Double
)

data class SalesByUserResponseDto(
    val filters: SalesByUserFiltersDto,
    val totals: SalesByUserTotalsDto,
    val rows: List<SalesByUserRowDto>,
    val tickets: List<TicketDto>
)

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
