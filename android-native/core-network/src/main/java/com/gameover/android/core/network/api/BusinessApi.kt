package com.gameover.android.core.network.api

import com.gameover.android.core.network.model.*
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.Path

interface BusinessApi {
    @GET("/api/draws")
    suspend fun draws(): List<DrawDto>

    @POST("/api/tickets")
    suspend fun createTicket(@Body body: CreateTicketRequest): TicketDto

    @GET("/api/tickets")
    suspend fun tickets(
        @Query("drawId") drawId: String? = null,
        @Query("sellerId") sellerId: String? = null,
        @Query("associateId") associateId: String? = null,
        @Query("includeCanceled") includeCanceled: Boolean? = null
    ): List<TicketDto>

    @GET("/api/tickets/{id}")
    suspend fun ticketById(@Path("id") ticketId: String): TicketDto

    @PATCH("/api/tickets/{id}/print")
    suspend fun markTicketPrinted(@Path("id") ticketId: String): TicketDto

    @PATCH("/api/tickets/{id}/cancel")
    suspend fun cancelTicket(
        @Path("id") ticketId: String,
        @Body body: Map<String, String?>
    ): TicketDto

    @GET("/api/reports/summary")
    suspend fun summary(
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null
    ): ReportSummaryDto

    @GET("/api/reports/top-numbers")
    suspend fun topNumbers(
        @Query("drawId") drawId: String? = null,
        @Query("limit") limit: Int,
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null
    ): List<TopNumberDto>

    @GET("/api/reports/recent-tickets")
    suspend fun recentTickets(
        @Query("limit") limit: Int,
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null
    ): List<RecentTicketDto>

    @GET("/api/reports/sales-by-user")
    suspend fun salesByUser(
        @Query("drawId") drawId: String? = null,
        @Query("userId") userId: String? = null,
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null
    ): SalesByUserResponseDto

    @GET("/api/payments/winning-tickets")
    suspend fun winningTickets(
        @Query("drawId") drawId: String,
        @Query("status") status: String,
        @Query("code") code: String?
    ): WinningTicketsResponseDto

    @GET("/api/reports/balance-breakdown")
    suspend fun balanceBreakdown(
        @Query("drawId") drawId: String? = null,
        @Query("userId") userId: String? = null,
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null
    ): Map<String, Any?>
}
