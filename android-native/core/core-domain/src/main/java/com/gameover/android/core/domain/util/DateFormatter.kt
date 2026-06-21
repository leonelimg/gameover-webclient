package com.gameover.android.core.domain.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object DateFormatter {
    private val localeNi = Locale("es", "NI")
    private val dateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy, hh:mm a", localeNi).withZone(ZoneId.systemDefault())
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", localeNi).withZone(ZoneId.systemDefault())
    private val timeFormatter = DateTimeFormatter.ofPattern("hh:mm a", localeNi).withZone(ZoneId.systemDefault())

    fun format(isoString: String): String {
        return try {
            dateTimeFormatter.format(Instant.parse(isoString)).lowercase(localeNi)
        } catch (e: Exception) {
            isoString.take(16).replace("T", " ")
        }
    }

    fun formatDate(isoString: String): String {
        return try {
            dateFormatter.format(Instant.parse(isoString))
        } catch (e: Exception) {
            isoString.take(10)
        }
    }

    fun formatTime(isoString: String): String {
        return try {
            timeFormatter.format(Instant.parse(isoString)).lowercase(localeNi)
        } catch (e: Exception) {
            isoString.substringAfter('T', "").take(5)
        }
    }
}
