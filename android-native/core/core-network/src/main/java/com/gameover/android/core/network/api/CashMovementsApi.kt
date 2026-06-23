package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.CashMovementBalanceResponseDto
import com.gameover.android.core.network.dto.CashMovementTargetDto
import com.gameover.android.core.network.dto.CashMovementHistoryItemDto
import com.gameover.android.core.network.dto.CashMovementEventSummaryResponseDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface CashMovementsApi {
    @GET("api/cash-movements/balance")
    suspend fun getBalance(
        @Query("targetUserId") targetUserId: String?,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): Response<CashMovementBalanceResponseDto>

    @GET("api/cash-movements/targets")
    suspend fun getTargets(): Response<List<CashMovementTargetDto>>

    @GET("api/cash-movements")
    suspend fun getHistory(
        @Query("targetUserId") targetUserId: String?,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?,
        @Query("limit") limit: Int?
    ): Response<List<CashMovementHistoryItemDto>>

    @GET("api/cash-movements/summary-by-event")
    suspend fun getSummaryByEvent(
        @Query("targetUserId") targetUserId: String?,
        @Query("fromDate") fromDate: String?,
        @Query("toDate") toDate: String?
    ): Response<CashMovementEventSummaryResponseDto>
}

