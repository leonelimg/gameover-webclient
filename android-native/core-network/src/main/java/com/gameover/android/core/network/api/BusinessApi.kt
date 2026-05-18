package com.gameover.android.core.network.api

import com.gameover.android.core.network.model.*
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Query

interface BusinessApi {
    @GET("/api/draws")
    suspend fun draws(): List<DrawDto>

    @POST("/api/tickets")
    suspend fun createTicket(@Body body: CreateTicketRequest)

    @PATCH("/api/tickets/{id}/print")
    suspend fun markTicketPrinted(@retrofit2.http.Path("id") ticketId: String)

    @PATCH("/api/tickets/{id}/cancel")
    suspend fun cancelTicket(
        @retrofit2.http.Path("id") ticketId: String,
        @Body body: Map<String, String?>
    )

    @GET("/api/reports/summary")
    suspend fun summary(
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): ReportSummaryDto

    @GET("/api/reports/top-numbers")
    suspend fun topNumbers(
        @Query("drawId") drawId: String?,
        @Query("limit") limit: Int,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): List<TopNumberDto>

    @GET("/api/reports/recent-tickets")
    suspend fun recentTickets(
        @Query("limit") limit: Int,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): List<Map<String, Any?>>

    @GET("/api/payments/winning-tickets")
    suspend fun winningTickets(
        @Query("drawId") drawId: String,
        @Query("status") status: String,
        @Query("code") code: String?
    ): WinningTicketsResponseDto

    @GET("/api/reports/balance-breakdown")
    suspend fun balanceBreakdown(
        @Query("drawId") drawId: String?,
        @Query("userId") userId: String?,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): Map<String, Any?>
}
