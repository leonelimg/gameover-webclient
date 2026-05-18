package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.ReportSummaryDto
import com.gameover.android.feature.dashboard.DashboardDateRange
import com.gameover.android.feature.dashboard.DashboardDateRangeResolver
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DashboardUiState(
    val summary: ReportSummaryDto? = null,
    val staleData: Boolean = false,
    val message: String? = null
)

class DashboardViewModel(
    private val businessApi: BusinessApi
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

            _state.value = runCatching {
                val summary = businessApi.summary(dates.fromDate, dates.toDate)
                ResultState.Success(DashboardUiState(summary = summary, staleData = false))
            }.getOrElse {
                ResultState.Error(AppError.Network("No fue posible actualizar dashboard"))
            }
        }
    }
}
