package com.gameover.android.core.domain.usecase

import com.gameover.android.core.domain.repository.OfflineQueueRepository
import javax.inject.Inject

class EnqueueOfflineSaleUseCase @Inject constructor(private val offlineQueueRepository: OfflineQueueRepository) {
    suspend operator fun invoke(
        drawId: String,
        customerName: String,
        linesJson: String,
    ): Result<Unit> = runCatching {
        offlineQueueRepository.enqueue(drawId, customerName, linesJson)
    }
}
