package com.gameover.android.feature.dashboard

import java.time.LocalDate

enum class DashboardDateRange { TODAY, LAST_7, WEEK, MONTH, CUSTOM }

data class DateFilter(val fromDate: String, val toDate: String)

object DashboardDateRangeResolver {
    fun resolve(range: DashboardDateRange, customFrom: LocalDate? = null, customTo: LocalDate? = null): DateFilter {
        val now = LocalDate.now()
        val from = when (range) {
            DashboardDateRange.TODAY -> now
            DashboardDateRange.LAST_7 -> now.minusDays(6)
            DashboardDateRange.WEEK -> now.minusDays(((now.dayOfWeek.value + 6) % 7).toLong())
            DashboardDateRange.MONTH -> now.withDayOfMonth(1)
            DashboardDateRange.CUSTOM -> customFrom ?: now
        }
        val to = if (range == DashboardDateRange.CUSTOM) customTo ?: now else now
        return DateFilter(from.toString(), to.toString())
    }
}
