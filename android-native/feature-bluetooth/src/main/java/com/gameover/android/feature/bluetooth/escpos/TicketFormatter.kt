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

    private fun stripDateFromDrawLabel(value: String): String {
        val normalized = value.trim().replace(Regex("\\s+"), " ")
        val parts = normalized.split(Regex("\\s+-\\s+"))
        if (parts.size < 2) return normalized

        val suffix = parts.drop(1).joinToString(" - ")
        val looksLikeDateTime = Regex("(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}:\\d{2}|\\b[ap]\\.?\\s?m\\.?\\b)", RegexOption.IGNORE_CASE)
            .containsMatchIn(suffix)
        if (!looksLikeDateTime) return normalized

        return parts.first().trim()
    }

    private data class GroupedLine(
        val numbers: String,
        val amount: Double,
        val special: Double,
    )

    private fun wrapGroupedNumbers(numbers: String, width: Int): List<String> {
        val tokens = numbers
            .split(",")
            .map { it.trim() }
            .filter { it.isNotBlank() }

        if (tokens.isEmpty()) return listOf("")

        val lines = mutableListOf<String>()
        var current = ""

        for (token in tokens) {
            val candidate = if (current.isBlank()) token else "$current, $token"
            if (candidate.length <= width) {
                current = candidate
            } else {
                if (current.isNotBlank()) lines.add(current)
                current = token
            }
        }

        if (current.isNotBlank()) lines.add(current)
        return lines
    }

    private fun groupLines(ticket: Ticket, showSpecialColumn: Boolean): List<GroupedLine> {
        val grouped = linkedMapOf<String, Pair<MutableList<String>, Pair<Double, Double>>>()

        for (line in ticket.lines) {
            val special = if (showSpecialColumn) (line.specialAmount ?: 0.0) else 0.0
            val key = if (showSpecialColumn) {
                "%.2f|%.2f".format(line.amount, special)
            } else {
                "%.2f".format(line.amount)
            }

            val current = grouped[key]
            if (current != null) {
                current.first.add(line.number)
            } else {
                grouped[key] = Pair(mutableListOf(line.number), Pair(line.amount, special))
            }
        }

        return grouped.values.map { (numbers, values) ->
            GroupedLine(
                numbers = numbers.joinToString(", "),
                amount = values.first,
                special = values.second,
            )
        }
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
        val rawDrawName = draw?.name ?: ticket.draw?.name ?: ticket.drawId
        val drawName = stripDateFromDrawLabel(rawDrawName)
        val drawDateStr = draw?.closeTime?.let(::formatDate) ?: ""
        val ticketDateStr = formatDate(ticket.createdAt)
        val customerName = ticket.customerName.trim().ifBlank { "Anonimo" }
        val groupedLines = groupLines(ticket, showSpecialColumn)
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
            .boldOn().textLn(drawName).boldOff()
            .textLn("Fecha ticket: $ticketDateStr")
            .run {
                if (drawDateStr.isNotBlank()) {
                    textLn("Fecha sorteo: $drawDateStr")
                } else {
                    this
                }
            }
            .textLn("Cliente: $customerName")
            .boldOn().textLn("Puesto: $sellerName").boldOff()
            .divider()
            .run {
                if (showSpecialColumn) {
                    boldOn()
                        .textLn("Numero         Monto Especial")
                        .boldOff()
                } else {
                    boldOn()
                        .textLn("Numero               Monto")
                        .boldOff()
                }
            }
            .run {
                var builder = this
                for (line in groupedLines) {
                    if (showSpecialColumn) {
                        val wrapped = wrapGroupedNumbers(line.numbers, 14)
                        val amount = padLeft("C$${"%.2f".format(line.amount)}", 8)
                        val special = padLeft("C$${"%.2f".format(line.special)}", 8)
                        wrapped.forEachIndexed { index, value ->
                            builder = if (index == 0) {
                                builder.textLn("${padRight(value, 14)} $amount $special")
                            } else {
                                builder.textLn(value)
                            }
                        }
                    } else {
                        val wrapped = wrapGroupedNumbers(line.numbers, 20)
                        val amount = padLeft("C$${"%.2f".format(line.amount)}", 11)
                        wrapped.forEachIndexed { index, value ->
                            builder = if (index == 0) {
                                builder.textLn("${padRight(value, 20)} $amount")
                            } else {
                                builder.textLn(value)
                            }
                        }
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
