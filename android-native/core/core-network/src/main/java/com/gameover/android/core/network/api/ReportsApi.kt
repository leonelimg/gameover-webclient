package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.*
import retrofit2.Response
import retrofit2.http.*

interface ReportsApi {
    @GET("api/reports/summary")
    suspend fun getSummary(
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null,
        @Query("drawId") drawId: String? = null,
    ): Response<ReportSummaryDto>

    @GET("api/reports/top-numbers")
    suspend fun getTopNumbers(
        @Query("drawId") drawId: String,
        @Query("limit") limit: Int = 10,
    ): Response<List<TopNumberDto>>

    @GET("api/reports/recent-tickets")
    suspend fun getRecentTickets(
        @Query("limit") limit: Int = 5,
    ): Response<List<TicketDto>>

    @GET("api/reports/draw-lists")
    suspend fun getDrawLists(
        @Query("drawId") drawId: String,
    ): Response<DrawListResponseDto>

    @GET("api/reports/balance-breakdown")
    suspend fun getBalanceBreakdown(
        @Query("drawId") drawId: String?,
        @Query("userId") userId: String?,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): Response<BalanceBreakdownResponseDto>

    @GET("api/users")
    suspend fun getUsers(): Response<List<UserDto>>

    @GET("api/payments/winning-tickets")
    suspend fun getWinningTickets(
        @Query("drawId") drawId: String,
        @Query("status") status: String? = "all",
        @Query("code") code: String? = null
    ): Response<WinningTicketsResponseDto>

    @PATCH("api/payments/mark-paid")
    suspend fun markPaid(
        @Body request: MarkPaidRequestDto
    ): Response<MarkPaidResponseDto>
}

