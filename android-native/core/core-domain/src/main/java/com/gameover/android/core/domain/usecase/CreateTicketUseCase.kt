package com.gameover.android.core.domain.usecase

import com.gameover.android.core.domain.model.DrawStatus
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.repository.CreateTicketLine
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import javax.inject.Inject

class CreateTicketUseCase @Inject constructor(
    private val ticketsRepository: TicketsRepository,
    private val drawsRepository: DrawsRepository,
) {
    suspend operator fun invoke(
        drawId: String,
        customerName: String,
        lines: List<CreateTicketLine>,
    ): Result<Ticket> = runCatching {
        val draw = drawsRepository.getDraws().find { it.id == drawId }
            ?: error("Sorteo no encontrado.")
        if (!draw.isOpen()) error("El sorteo no está en horario de venta.")
        if (draw.status == DrawStatus.finalizado) error("No se puede vender en un sorteo finalizado.")
        val numberRegex = Regex("^\\d{2}$")
        for (line in lines) {
            if (!numberRegex.matches(line.number)) error("El número debe tener exactamente 2 dígitos.")
            if (line.amount <= 0) error("El monto debe ser mayor a cero.")
            if (draw.specialMultiplier != null) {
                val special = line.specialAmount ?: 0.0
                if (special < 0) error("El monto especial no puede ser negativo.")
                if (special > line.amount) error("El monto especial del número ${line.number} no puede superar el monto regular.")
            }
        }
        ticketsRepository.createTicket(drawId, customerName, lines)
    }
}
