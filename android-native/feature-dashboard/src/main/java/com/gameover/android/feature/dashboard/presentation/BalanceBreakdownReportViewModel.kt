package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.model.BalanceBreakdownResponse
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.ReportsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class BalanceBreakdownReportUiState(
    val isLoading: Boolean = false,
    val selectedRange: DashboardRange = DashboardRange.TODAY,
    val customFromDate: String = "",
    val customToDate: String = "",
    val draws: List<Draw> = emptyList(),
    val selectedDrawId: String? = null,
    val users: List<User> = emptyList(),
    val selectedUserId: String? = null,
    val report: BalanceBreakdownResponse? = null,
    val error: String? = null
)

@HiltViewModel
class BalanceBreakdownReportViewModel @Inject constructor(
    private val drawsRepository: DrawsRepository,
    private val reportsRepository: ReportsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BalanceBreakdownReportUiState())
    val uiState: StateFlow<BalanceBreakdownReportUiState> = _uiState.asStateFlow()

    init {
        loadInitialData()
    }

    fun onRangeSelected(range: DashboardRange) {
        _uiState.update { it.copy(selectedRange = range) }
        if (range != DashboardRange.CUSTOM) {
            loadDrawsAndReport()
        }
    }

    fun onCustomDateChanged(from: String, to: String) {
        _uiState.update { it.copy(customFromDate = from, customToDate = to) }
        if (from.isNotBlank() && to.isNotBlank()) {
            loadDrawsAndReport()
        }
    }

    fun onDrawSelected(drawId: String?) {
        _uiState.update { it.copy(selectedDrawId = drawId) }
        loadReport()
    }

    fun onUserSelected(userId: String?) {
        _uiState.update { it.copy(selectedUserId = userId) }
        loadReport()
    }

    fun clearFilters() {
        _uiState.update { 
            it.copy(
                selectedRange = DashboardRange.TODAY,
                selectedDrawId = null,
                selectedUserId = null,
                customFromDate = "",
                customToDate = ""
            ) 
        }
        loadDrawsAndReport()
    }

    fun refresh() {
        loadInitialData()
    }

    private fun loadInitialData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val users = reportsRepository.getUsers()
                val (from, to) = getDatesForRange(_uiState.value.selectedRange)
                val draws = drawsRepository.getDraws(from, to)
                
                _uiState.update { 
                    it.copy(
                        users = users,
                        draws = draws
                    ) 
                }
                loadReport()
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al inicializar datos") }
            }
        }
    }

    private fun loadDrawsAndReport() {
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
                
                // Clear draw selection if it is no longer within the date-filtered draws list
                val activeDrawId = _uiState.value.selectedDrawId
                val newDrawId = if (activeDrawId != null && draws.any { it.id == activeDrawId }) {
                    activeDrawId
                } else {
                    null
                }

                _uiState.update { 
                    it.copy(
                        draws = draws,
                        selectedDrawId = newDrawId
                    ) 
                }
                loadReport()
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar sorteos") }
            }
        }
    }

    private fun loadReport() {
        val state = _uiState.value
        if (state.selectedRange == DashboardRange.CUSTOM && 
            (state.customFromDate.isBlank() || state.customToDate.isBlank())) {
            return
        }
        val (from, to) = getDatesForRange(state.selectedRange)

        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val report = reportsRepository.getBalanceBreakdown(
                    drawId = state.selectedDrawId,
                    userId = state.selectedUserId,
                    fromDate = from,
                    toDate = to
                )
                _uiState.update { 
                    it.copy(
                        report = report,
                        isLoading = false
                    ) 
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
            // Strict Monday-to-Sunday calculation
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
