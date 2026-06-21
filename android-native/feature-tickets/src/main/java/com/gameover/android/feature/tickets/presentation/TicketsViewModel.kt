package com.gameover.android.feature.tickets.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.repository.DataRefreshNotifier
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.ui.util.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class TicketsViewModel @Inject constructor(
    private val ticketsRepository: TicketsRepository,
    private val drawsRepository: DrawsRepository,
    private val networkMonitor: NetworkMonitor,
    private val dataRefreshNotifier: DataRefreshNotifier,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TicketsUiState())
    val uiState: StateFlow<TicketsUiState> = _uiState.asStateFlow()

    init {
        loadData()
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                _uiState.update { it.copy(isOnline = online) }
                if (online) loadData()
            }
        }
        viewModelScope.launch {
            dataRefreshNotifier.refreshEvents.collect {
                if (_uiState.value.isOnline) loadData()
            }
        }
    }

    fun loadData() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val draws = drawsRepository.getDraws()
                                val (fromDate, toDate) = getDatesForRange(_uiState.value.selectedRange)
                val tickets = ticketsRepository.getTickets(
                    drawId = _uiState.value.selectedDrawId.takeIf { it.isNotBlank() },
                    includeCanceled = _uiState.value.includeCanceled,
                                    fromDate = fromDate,
                                    toDate = toDate,
                )
                _uiState.update { it.copy(draws = draws, tickets = tickets, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun onSearchQueryChanged(query: String) = _uiState.update { it.copy(searchQuery = query) }
    fun onDrawFilterChanged(drawId: String) {
        _uiState.update { it.copy(selectedDrawId = drawId) }
        loadData()
    }
    fun onIncludeCanceledChanged(include: Boolean) {
        _uiState.update { it.copy(includeCanceled = include) }
        loadData()
    }
    fun onRangeSelected(range: DashboardRange) {
        _uiState.update { it.copy(selectedRange = range) }
        loadData()
    }
    fun onCodeScanned(code: String) = _uiState.update { it.copy(searchQuery = code) }

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
