package com.gameover.android.core.domain.usecase

import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.repository.TicketsRepository
import javax.inject.Inject

class CancelTicketUseCase @Inject constructor(private val ticketsRepository: TicketsRepository) {
    suspend operator fun invoke(id: String, reason: String?): Result<Ticket> =
        runCatching { ticketsRepository.cancelTicket(id, reason) }
}
