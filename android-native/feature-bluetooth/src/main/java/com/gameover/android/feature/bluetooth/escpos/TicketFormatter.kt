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

    private fun buildFooterLines(footerNote: String, effectiveMultiplier: Number?): List<String> {
        val lines = mutableListOf<String>()

        if (effectiveMultiplier != null) {
            lines.add("Multiplicador: ${effectiveMultiplier}x")
        }

        lines.addAll(
            footerNote
                .split("\n")
                .map { it.trim() }
                .filter { it.isNotBlank() },
        )

        return lines
    }

    fun format(
        ticket: Ticket,
        draw: Draw?,
        sellerName: String,
        ticketTitle: String = "GameOver Lotería",
        footerNote: String = "",
        effectiveMultiplier: Number? = null,
        ticketCodeFontSize: Int = 32,
    ): ByteArray {
        val lines = getTicketLines(
            ticket, draw, sellerName, ticketTitle, footerNote, effectiveMultiplier, ticketCodeFontSize
        )

        val builder = EscPosBuilder().init()
        for (line in lines) {
            when (line.alignment) {
                TicketAlignment.CENTER -> builder.alignCenter()
                TicketAlignment.LEFT -> builder.alignLeft()
                TicketAlignment.RIGHT -> builder.alignRight()
            }

            if (line.isBold) builder.boldOn() else builder.boldOff()
            if (line.isDoubleSize) builder.doubleSizeOn() else builder.normalSize()

            if (line.text == "---DIVIDER---") {
                builder.divider()
            } else {
                builder.textLn(line.text)
            }
        }

        return builder
            .lineFeed(2)
            .lineFeed(3)
            .partialCut()
            .build()
    }

    data class TicketTextLine(
        val text: String,
        val isBold: Boolean = false,
        val alignment: TicketAlignment = TicketAlignment.LEFT,
        val isDoubleSize: Boolean = false
    )

    enum class TicketAlignment { LEFT, CENTER, RIGHT }

    fun getTicketLines(
        ticket: Ticket,
        draw: Draw?,
        sellerName: String,
        ticketTitle: String = "GameOver Lotería",
        footerNote: String = "",
        effectiveMultiplier: Number? = null,
        ticketCodeFontSize: Int = 32,
    ): List<TicketTextLine> {
        val hasSpecial = ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }
        val specialMultiplierValue = draw?.specialMultiplier?.value ?: ticket.draw?.specialMultiplier?.value
        val drawHasSpecial = specialMultiplierValue?.let { it > 0 } ?: hasSpecial
        val showSpecialColumn = drawHasSpecial && hasSpecial
        val rawDrawName = draw?.name ?: ticket.draw?.name ?: ticket.drawId
        val drawName = stripDateFromDrawLabel(rawDrawName)
        val drawDateStr = draw?.closeTime?.let(::formatDate) ?: ""
        val ticketDateStr = formatDate(ticket.createdAt)
        val customerName = ticket.customerName.trim().ifBlank { "Anonimo" }
        val groupedLines = groupLines(ticket, showSpecialColumn)
        val footerLines = buildFooterLines(footerNote, effectiveMultiplier)

        val result = mutableListOf<TicketTextLine>()

        result.add(TicketTextLine(ticketTitle, isBold = true, alignment = TicketAlignment.CENTER))
        result.add(TicketTextLine(ticket.code, isBold = true, alignment = TicketAlignment.CENTER, isDoubleSize = ticketCodeFontSize >= 30))
        result.add(TicketTextLine(drawName, isBold = true, alignment = TicketAlignment.LEFT))
        if (drawDateStr.isNotBlank()) {
            result.add(TicketTextLine("Fecha sorteo: $drawDateStr"))
        }
        result.add(TicketTextLine("Fecha ticket: $ticketDateStr"))
        result.add(TicketTextLine("Cliente: $customerName"))
        result.add(TicketTextLine("Puesto: $sellerName", isBold = true))
        result.add(TicketTextLine("---DIVIDER---"))

        if (showSpecialColumn) {
            result.add(TicketTextLine("Numero         Monto Especial", isBold = true))
        } else {
            result.add(TicketTextLine("Numero               Monto", isBold = true))
        }

        for (line in groupedLines) {
            if (showSpecialColumn) {
                val wrapped = wrapGroupedNumbers(line.numbers, 14)
                val amount = padLeft("C$${"%.2f".format(line.amount)}", 8)
                val special = padLeft("C$${"%.2f".format(line.special)}", 8)
                wrapped.forEachIndexed { index, value ->
                    if (index == 0) {
                        result.add(TicketTextLine("${padRight(value, 14)} $amount $special"))
                    } else {
                        result.add(TicketTextLine(value))
                    }
                }
            } else {
                val wrapped = wrapGroupedNumbers(line.numbers, 20)
                val amount = padLeft("C$${"%.2f".format(line.amount)}", 11)
                wrapped.forEachIndexed { index, value ->
                    if (index == 0) {
                        result.add(TicketTextLine("${padRight(value, 20)} $amount"))
                    } else {
                        result.add(TicketTextLine(value))
                    }
                }
            }
        }

        result.add(TicketTextLine("---DIVIDER---"))
        result.add(TicketTextLine("TOTAL: C$ ${"%.2f".format(ticket.total)}", isBold = true, alignment = TicketAlignment.RIGHT))

        if (footerLines.isNotEmpty()) {
            for (line in footerLines) {
                result.add(TicketTextLine(line, alignment = TicketAlignment.CENTER))
            }
        }

        return result
    }
}
