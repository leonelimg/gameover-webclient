package com.gameover.android.feature.bluetooth.escpos

import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.Draw
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object TicketFormatter {

    private const val TICKET_WIDTH = 32 // chars for 58mm thermal printer
    private val localeNi = Locale("es", "NI")
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy, hh:mm a", localeNi).withZone(ZoneId.systemDefault())

    private fun formatDate(value: String): String {
        return try {
            dateFormatter.format(Instant.parse(value)).lowercase(localeNi)
        } catch (e: Exception) {
            value.take(16).replace("T", " ")
        }
    }

    private fun formatDrawLabel(draw: Draw?): String {
        if (draw == null) return ""
        val closeLabel = try {
            dateFormatter.format(Instant.parse(draw.closeTime)).lowercase(localeNi)
        } catch (_: Exception) {
            ""
        }
        return if (closeLabel.isBlank()) draw.name else "${draw.name} - $closeLabel"
    }

    private fun padRight(value: String, width: Int): String =
        if (value.length >= width) value.take(width) else value + " ".repeat(width - value.length)

    private fun padLeft(value: String, width: Int): String =
        if (value.length >= width) value.takeLast(width) else " ".repeat(width - value.length) + value

    private fun applyTicketCodeSize(builder: EscPosBuilder, ticketCodeFontSize: Int): EscPosBuilder {
        return if (ticketCodeFontSize >= 30) {
            builder.doubleSizeOn()
        } else {
            builder.normalSize()
        }
    }

    fun format(
        ticket: Ticket,
        draw: Draw?,
        sellerName: String,
        ticketTitle: String = "GameOver Lotería",
        footerNote: String = "",
        ticketCodeFontSize: Int = 32,
    ): ByteArray {
        val hasSpecial = ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }
        val specialMultiplierValue = draw?.specialMultiplier?.value ?: ticket.draw?.specialMultiplier?.value
        val drawHasSpecial = specialMultiplierValue?.let { it > 0 } ?: hasSpecial
        val showSpecialColumn = drawHasSpecial && hasSpecial
        val effectiveMultiplier = specialMultiplierValue
        val dateStr = formatDate(ticket.createdAt)
        val drawLabel = formatDrawLabel(draw).ifBlank { draw?.name ?: ticket.draw?.name ?: ticket.drawId }
        val footerLines = footerNote
            .split("\n")
            .map { it.trim() }
            .filter { it.isNotBlank() }

        return EscPosBuilder()
            .init()
            .alignCenter()
            .boldOn().textLn(ticketTitle).boldOff()
            .run { applyTicketCodeSize(this, ticketCodeFontSize) }
            .boldOn().textLn(ticket.code).boldOff().normalSize()
            .alignLeft()
            .textLn("Sorteo: $drawLabel")
            .run { if (ticket.customerName.isNotBlank()) textLn("Cliente: ${ticket.customerName}") else textLn("Cliente:") }
            .textLn("Vendedor: $sellerName")
            .textLn("Fecha:  $dateStr")
            .divider()
            .run {
                if (showSpecialColumn) {
                    boldOn()
                        .textLn("Numero  Regular Especial Total")
                        .boldOff()
                } else {
                    boldOn()
                        .textLn("Numero    Regular      Total")
                        .boldOff()
                }
            }
            .run {
                var builder = this
                for (line in ticket.lines) {
                    val number = padRight(line.number, 6)
                    val regular = padLeft("C$${"%.2f".format(line.amount)}", 8)
                    if (showSpecialColumn) {
                        val special = padLeft("C$${"%.2f".format(line.specialAmount ?: 0.0)}", 8)
                        val total = padLeft("C$${"%.2f".format(line.amount + (line.specialAmount ?: 0.0))}", 8)
                        builder = builder.textLn("$number $regular $special $total")
                    } else {
                        val total = padLeft("C$${"%.2f".format(line.amount)}", 10)
                        builder = builder.textLn("$number ${padLeft("C$${"%.2f".format(line.amount)}", 10)} $total")
                    }
                }
                builder
            }
            .divider()
            .alignRight()
            .boldOn()
            .textLn("TOTAL: C$ ${"%.2f".format(ticket.total)}")
            .boldOff()
            .alignCenter()
            .run {
                if (effectiveMultiplier != null) {
                    textLn("Multiplicador: ${effectiveMultiplier}x")
                } else {
                    this
                }
            }
            .run {
                if (footerLines.isEmpty()) {
                    this
                } else {
                    var builder = this
                    for (line in footerLines) {
                        builder = builder.textLn(line)
                    }
                    builder
                }
            }
            .lineFeed(2)
            .lineFeed(3)
            .partialCut()
            .build()
    }
}
