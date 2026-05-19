package com.gameover.android.feature.bluetooth.escpos

import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.Draw
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object TicketFormatter {

    private const val TICKET_WIDTH = 32 // chars for 58mm thermal printer
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault())

    fun format(ticket: Ticket, draw: Draw?, sellerName: String, businessName: String = "GameOver Lotería"): ByteArray {
        val hasSpecial = ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }
        val dateStr = try {
            dateFormatter.format(Instant.parse(ticket.createdAt))
        } catch (e: Exception) { ticket.createdAt.take(16).replace("T", " ") }

        return EscPosBuilder()
            .init()
            // Header
            .alignCenter()
            .boldOn().doubleSizeOn()
            .textLn(businessName)
            .normalSize().boldOff()
            .lineFeed()
            .boldOn()
            .textLn(ticket.code)
            .boldOff()
            .alignLeft()
            .lineFeed()
            // Details
            .textLn("Sorteo: ${draw?.name ?: ticket.drawId}")
            .textLn("Fecha:  $dateStr")
            .textLn("Caja:   $sellerName")
            .run { if (ticket.customerName.isNotBlank()) textLn("Cliente: ${ticket.customerName}") else this }
            .divider()
            // Lines header
            .run {
                if (hasSpecial) {
                    textLn("Num  Regular    Especial")
                    textLn("---- ---------- ----------")
                } else {
                    textLn("Num  Monto (C$)")
                    textLn("---- ----------")
                }
            }
            // Bet lines
            .run {
                var builder = this
                for (line in ticket.lines) {
                    val num = line.number.padStart(4)
                    val amt = "%.2f".format(line.amount).padStart(10)
                    if (hasSpecial) {
                        val special = "%.2f".format(line.specialAmount ?: 0.0).padStart(10)
                        builder = builder.textLn("$num $amt $special")
                    } else {
                        builder = builder.textLn("$num $amt")
                    }
                }
                builder
            }
            .divider()
            // Total
            .alignRight()
            .boldOn()
            .textLn("TOTAL: C$ ${"%.2f".format(ticket.total)}")
            .boldOff()
            .alignCenter()
            .lineFeed()
            // QR code
            .qrCode(ticket.code)
            .lineFeed(2)
            // Footer
            .textLn(businessName)
            .textLn("Gracias por su preferencia")
            .lineFeed(3)
            .partialCut()
            .build()
    }
}
