package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.domain.model.CashMovementBalance
import com.gameover.android.core.domain.model.CashMovementTarget
import com.gameover.android.core.domain.model.CashMovementHistoryItem
import com.gameover.android.core.domain.model.CashMovementEventSummaryResponse
import com.gameover.android.core.domain.repository.CashMovementsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class DepositsWithdrawalsReportUiState(
    val isLoading: Boolean = false,
    val selectedRange: DashboardRange = DashboardRange.TODAY,
    val customFromDate: String = "",
    val customToDate: String = "",
    val targets: List<CashMovementTarget> = emptyList(),
    val selectedTargetId: String? = null,
    val balance: CashMovementBalance? = null,
    val historyItems: List<CashMovementHistoryItem> = emptyList(),
    val eventSummary: CashMovementEventSummaryResponse? = null,
    val selectedTabIndex: Int = 0, // 0 = Movimientos, 1 = Por Evento
    val error: String? = null
)

@HiltViewModel
class DepositsWithdrawalsReportViewModel @Inject constructor(
    private val cashMovementsRepository: CashMovementsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DepositsWithdrawalsReportUiState())
    val uiState: StateFlow<DepositsWithdrawalsReportUiState> = _uiState.asStateFlow()

    init {
        loadTargets()
    }

    fun onRangeSelected(range: DashboardRange) {
        _uiState.update { it.copy(selectedRange = range) }
        if (range != DashboardRange.CUSTOM) {
            loadData()
        }
    }

    fun onCustomDateChanged(from: String, to: String) {
        _uiState.update { it.copy(customFromDate = from, customToDate = to) }
        if (from.isNotBlank() && to.isNotBlank()) {
            loadData()
        }
    }

    fun onTargetSelected(targetId: String) {
        _uiState.update { it.copy(selectedTargetId = targetId) }
        loadData()
    }

    fun onTabSelected(index: Int) {
        _uiState.update { it.copy(selectedTabIndex = index) }
    }

    fun refresh() {
        loadData()
    }

    private fun loadTargets() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val targets = cashMovementsRepository.getTargets()
                val selectedId = targets.firstOrNull()?.id
                _uiState.update { 
                    it.copy(
                        targets = targets, 
                        selectedTargetId = selectedId,
                        isLoading = false
                    ) 
                }
                if (selectedId != null) {
                    loadData()
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar usuarios") }
            }
        }
    }

    private fun loadData() {
        val targetId = _uiState.value.selectedTargetId ?: return
        val state = _uiState.value
        if (state.selectedRange == DashboardRange.CUSTOM && 
            (state.customFromDate.isBlank() || state.customToDate.isBlank())) {
            return
        }
        val (from, to) = getDatesForRange(state.selectedRange)

        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                coroutineScope {
                    val balanceDeferred = async { cashMovementsRepository.getBalance(targetId, from, to) }
                    val historyDeferred = async { cashMovementsRepository.getHistory(targetId, from, to, limit = 200) }
                    val summaryDeferred = async { cashMovementsRepository.getSummaryByEvent(targetId, from, to) }

                    val balance = balanceDeferred.await()
                    val history = historyDeferred.await()
                    val summary = summaryDeferred.await()

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            balance = balance,
                            historyItems = history,
                            eventSummary = summary,
                            error = null
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar reporte") }
            }
        }
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
