package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.database.repository.DashboardCacheRepository
import com.gameover.android.core.network.NetworkErrorMapper
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.RecentTicketDto
import com.gameover.android.core.network.model.ReportSummaryDto
import com.gameover.android.core.network.model.TopNumberDto
import com.gameover.android.feature.dashboard.DashboardDateRange
import com.gameover.android.feature.dashboard.DashboardDateRangeResolver
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

data class DashboardUiState(
    val summary: ReportSummaryDto? = null,
    val topNumbers: List<TopNumberDto> = emptyList(),
    val recentTickets: List<RecentTicketDto> = emptyList(),
    val staleData: Boolean = false,
    val message: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val businessApi: BusinessApi,
    private val cacheRepository: DashboardCacheRepository
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<DashboardUiState>>(ResultState.Loading)
    val state: StateFlow<ResultState<DashboardUiState>> = _state

    fun load(range: DashboardDateRange, customFrom: String? = null, customTo: String? = null) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            val dates = DashboardDateRangeResolver.resolve(
                range,
                customFrom?.let(java.time.LocalDate::parse),
                customTo?.let(java.time.LocalDate::parse)
            )

            _state.value = runCatching<ResultState<DashboardUiState>> {
                coroutineScope {
                    val summaryDeferred = async { businessApi.summary(dates.fromDate, dates.toDate) }
                    val recentDeferred = async { businessApi.recentTickets(limit = 5, fromDate = dates.fromDate, toDate = dates.toDate) }
                    val topDeferred = async { businessApi.topNumbers(limit = 10, fromDate = dates.fromDate, toDate = dates.toDate) }

                    val summary = summaryDeferred.await()
                    val recent = recentDeferred.await()
                    val top = topDeferred.await()

                    cacheRepository.cacheSummary(
                        payloadJson = JSONObject(
                            mapOf(
                                "ticketCount" to summary.ticketCount,
                                "totalSales" to summary.totalSales,
                                "totalPrizes" to summary.totalPrizes,
                                "totalCommissions" to summary.totalCommissions,
                                "userCount" to summary.userCount,
                                "drawCount" to summary.drawCount
                            )
                        ).toString(),
                        fromDate = dates.fromDate,
                        toDate = dates.toDate
                    )
                    cacheRepository.cacheRecentTickets(
                        recent.map {
                            mapOf(
                                "id" to it.id,
                                "code" to it.code,
                                "drawId" to it.drawId,
                                "total" to it.total,
                                "createdAt" to it.createdAt,
                                "canceledAt" to it.canceledAt
                            )
                        }
                    )

                    ResultState.Success(
                        DashboardUiState(
                            summary = summary,
                            topNumbers = top,
                            recentTickets = recent,
                            staleData = false
                        )
                    )
                }
            }.getOrElse { throwable ->
                val cached = cacheRepository.readSummary(dates.fromDate, dates.toDate)
                if (cached != null) {
                    val json = JSONObject(cached.payloadJson)
                    val summary = ReportSummaryDto(
                        ticketCount = json.optInt("ticketCount"),
                        totalSales = json.optDouble("totalSales"),
                        totalPrizes = json.optDouble("totalPrizes"),
                        totalCommissions = json.optDouble("totalCommissions"),
                        userCount = json.optInt("userCount"),
                        drawCount = json.optInt("drawCount")
                    )
                    ResultState.Success(
                        DashboardUiState(
                            summary = summary,
                            topNumbers = emptyList(),
                            recentTickets = emptyList(),
                            staleData = true,
                            message = "Mostrando caché local"
                        )
                    )
                } else {
                    ResultState.Error(NetworkErrorMapper.toAppError(throwable, "No fue posible actualizar dashboard"))
                }
            }
        }
    }
}
