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
}
