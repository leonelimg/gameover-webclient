package com.gameover.android.feature.sales.domain

import com.gameover.android.core.database.repository.PendingSalesQueueRepository
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.CreateTicketRequest
import com.squareup.moshi.Moshi

class PendingSalesSyncUseCase(
    private val queueRepository: PendingSalesQueueRepository,
    private val businessApi: BusinessApi,
    private val moshi: Moshi = Moshi.Builder().build()
) {
    private val adapter = moshi.adapter(CreateTicketRequest::class.java)

    suspend fun syncAll() {
        queueRepository.allPending().forEach { item ->
            runCatching {
                val payload = requireNotNull(adapter.fromJson(item.payloadJson))
                businessApi.createTicket(payload)
                queueRepository.markSynced(item.id)
            }.onFailure {
                queueRepository.markFailed(item.id, item.attempts + 1, it.message)
            }
        }
    }
}
