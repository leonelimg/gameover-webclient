package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.*
import retrofit2.Response
import retrofit2.http.*

interface TicketsApi {
    @GET("api/tickets")
    suspend fun getTickets(
        @Query("drawId") drawId: String? = null,
        @Query("sellerId") sellerId: String? = null,
        @Query("includeCanceled") includeCanceled: Boolean? = null,
    ): Response<List<TicketDto>>

    @GET("api/tickets/{id}")
    suspend fun getTicket(@Path("id") id: String): Response<TicketDto>

    @POST("api/tickets")
    suspend fun createTicket(@Body request: CreateTicketRequest): Response<TicketDto>

    @PATCH("api/tickets/{id}/print")
    suspend fun markPrinted(@Path("id") id: String): Response<TicketDto>

    @PATCH("api/tickets/{id}/cancel")
    suspend fun cancelTicket(
        @Path("id") id: String,
        @Body request: Map<String, String>,
    ): Response<TicketDto>
}
