package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.WinningTicketsReport
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.ReportsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.gameover.android.core.domain.util.CurrencyFormatter
import java.time.LocalDate
import javax.inject.Inject

data class WinningTicketsReportUiState(
    val isLoading: Boolean = false,
    val draws: List<Draw> = emptyList(),
    val selectedDrawId: String? = null,
    val report: WinningTicketsReport? = null,
    val selectedRange: DashboardRange = DashboardRange.TODAY,
    val customFromDate: String = "",
    val customToDate: String = "",
    val operationSuccess: String? = null,
    val error: String? = null
)

@HiltViewModel
class WinningTicketsReportViewModel @Inject constructor(
    private val drawsRepository: DrawsRepository,
    private val reportsRepository: ReportsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(WinningTicketsReportUiState())
    val uiState: StateFlow<WinningTicketsReportUiState> = _uiState.asStateFlow()

    init {
        loadDraws()
    }

    fun onRangeSelected(range: DashboardRange) {
        _uiState.update { it.copy(selectedRange = range, selectedDrawId = null, report = null) }
        if (range != DashboardRange.CUSTOM) {
            loadDraws()
        }
    }

    fun onCustomDateChanged(from: String, to: String) {
        _uiState.update { it.copy(customFromDate = from, customToDate = to) }
        if (from.isNotBlank() && to.isNotBlank()) {
            loadDraws()
        }
    }

    fun onDrawSelected(drawId: String?) {
        _uiState.update { it.copy(selectedDrawId = drawId, report = null) }
        if (drawId != null) {
            loadReport(drawId)
        }
    }

    fun refresh() {
        val state = _uiState.value
        if (state.selectedRange == DashboardRange.CUSTOM && 
            (state.customFromDate.isBlank() || state.customToDate.isBlank())) {
            return
        }
        val currentDrawId = state.selectedDrawId
        if (currentDrawId != null) {
            loadReport(currentDrawId)
        } else {
            loadDraws()
        }
    }

    private fun loadDraws() {
        val state = _uiState.value
        if (state.selectedRange == DashboardRange.CUSTOM && 
            (state.customFromDate.isBlank() || state.customToDate.isBlank())) {
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val (from, to) = getDatesForRange(state.selectedRange)
                val draws = drawsRepository.getDraws(from, to)
                _uiState.update { it.copy(draws = draws, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar sorteos") }
            }
        }
    }

    private fun loadReport(drawId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val report = reportsRepository.getWinningTickets(drawId)
                _uiState.update { it.copy(report = report, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar reporte") }
            }
        }
    }

    fun markTicketAsPaid(ticketId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val result = reportsRepository.markPaid(ticketId)
                val currentDrawId = _uiState.value.selectedDrawId
                val formattedPrize = CurrencyFormatter.format(result.prizeAmount)
                _uiState.update { it.copy(
                    operationSuccess = "Ticket ${result.ticket.code} pagado correctamente por $formattedPrize."
                ) }
                if (currentDrawId != null) {
                    loadReport(currentDrawId)
                } else {
                    _uiState.update { it.copy(isLoading = false) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al marcar como pagado") }
            }
        }
    }

    fun clearOperationResult() {
        _uiState.update { it.copy(operationSuccess = null, error = null) }
    }

    private fun getDatesForRange(range: DashboardRange): Pair<String, String> {
        val today = LocalDate.now()
        return when (range) {
            DashboardRange.TODAY -> today.toString() to today.toString()
            DashboardRange.WEEK -> {
                val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
                val sunday = monday.plusDays(6)
                monday.toString() to sunday.toString()
            }
            DashboardRange.MONTH -> today.withDayOfMonth(1).toString() to today.toString()
            DashboardRange.CUSTOM -> _uiState.value.customFromDate to _uiState.value.customToDate
            else -> today.toString() to today.toString()
        }
    }
}
