package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.DrawListEntry
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

data class DrawListReportUiState(
    val isLoading: Boolean = false,
    val draws: List<Draw> = emptyList(),
    val selectedDrawId: String? = null,
    val reportEntries: List<DrawListEntry> = emptyList(),
    val selectedRange: DashboardRange = DashboardRange.TODAY,
    val error: String? = null
)

@HiltViewModel
class DrawListReportViewModel @Inject constructor(
    private val drawsRepository: DrawsRepository,
    private val reportsRepository: ReportsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DrawListReportUiState())
    val uiState: StateFlow<DrawListReportUiState> = _uiState.asStateFlow()

    init {
        loadDraws()
    }

    fun onRangeSelected(range: DashboardRange) {
        _uiState.update { it.copy(selectedRange = range, selectedDrawId = null, reportEntries = emptyList()) }
        loadDraws()
    }

    fun onDrawSelected(drawId: String) {
        _uiState.update { it.copy(selectedDrawId = drawId) }
        loadReport(drawId)
    }

    fun refresh() {
        val currentDrawId = _uiState.value.selectedDrawId
        if (currentDrawId != null) {
            loadReport(currentDrawId)
        } else {
            loadDraws()
        }
    }

    private fun loadDraws() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val (from, to) = getDatesForRange(_uiState.value.selectedRange)
                val draws = drawsRepository.getDraws(from, to)
                _uiState.update { it.copy(draws = draws, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    private fun loadReport(drawId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val entries = reportsRepository.getDrawLists(drawId)
                _uiState.update { it.copy(reportEntries = entries, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    private fun getDatesForRange(range: DashboardRange): Pair<String, String> {
        val today = LocalDate.now()
        return when (range) {
            DashboardRange.TODAY -> today.toString() to today.toString()
            //DashboardRange.WEEK -> today.minusDays((today.dayOfWeek.value % 7).toLong()).toString() to today.toString()
            DashboardRange.WEEK -> {
                val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
                val sunday = monday.plusDays(6)
                monday.toString() to sunday.toString()
            }
            DashboardRange.MONTH -> today.withDayOfMonth(1).toString() to today.toString()
            else -> today.toString() to today.toString()
        }
    }
}
