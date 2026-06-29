package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.repository.CashMovementsRepository
import com.gameover.android.core.domain.repository.DataRefreshNotifier
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.ReportsRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.domain.repository.AnnouncementRepository
import com.gameover.android.core.ui.util.NetworkMonitor
import com.gameover.android.core.domain.model.DashboardRange
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val reportsRepository: ReportsRepository,
    private val ticketsRepository: TicketsRepository,
    private val drawsRepository: DrawsRepository,
    private val announcementRepository: AnnouncementRepository,
    private val networkMonitor: NetworkMonitor,
    private val dataRefreshNotifier: DataRefreshNotifier,
    private val authRepository: AuthRepository,
    private val cashMovementsRepository: CashMovementsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    private val fmt = DateTimeFormatter.ISO_LOCAL_DATE

    init {
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
        loadData()
    }

    fun onRangeSelected(range: DashboardRange) {
        _uiState.update { it.copy(selectedRange = range) }
        if (range != DashboardRange.CUSTOM) loadData()
    }

    fun onCustomDateChanged(from: String, to: String) {
        _uiState.update { it.copy(customFromDate = from, customToDate = to) }
        if (from.isNotBlank() && to.isNotBlank()) loadData()
    }

    fun refresh() = loadData()


    private fun loadData() {
        val (from, to) = getDateRange()
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val userId = authRepository.getStoredUser().first()?.id
                coroutineScope {
                    val summaryDeferred = async { reportsRepository.getSummary(fromDate = from, toDate = to) }
                    val balanceDeferred = async { cashMovementsRepository.getBalance(targetUserId = userId, fromDate = from, toDate = to) }
                    val recentDeferred = async { reportsRepository.getRecentTickets(limit = 5, fromDate = from, toDate = to) }
                    val announcementsDeferred = async { announcementRepository.getActiveAnnouncements() }
                    
                    val summary = summaryDeferred.await()
                    val balance = try { balanceDeferred.await() } catch (e: Exception) { null }
                    val recent = recentDeferred.await()
                    val announcements = try { announcementsDeferred.await() } catch (e: Exception) { emptyList() }
                    
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            summary = summary,
                            finalBalance = balance?.totals?.balance,
                            recentTickets = recent,
                            announcementCount = announcements.size,
                            error = null,
                        )
                    }
                }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar datos") }
            }
        }
    }

    private fun getDateRange(): Pair<String, String> {
        val today = LocalDate.now()
        return when (_uiState.value.selectedRange) {
            DashboardRange.TODAY -> Pair(today.format(fmt), today.format(fmt))
            DashboardRange.LAST7 -> Pair(today.minusDays(6).format(fmt), today.format(fmt))
            DashboardRange.WEEK -> {
                val monday = today.minusDays(today.dayOfWeek.value.toLong() - 1)
                Pair(monday.format(fmt), today.format(fmt))
            }
            DashboardRange.MONTH -> Pair(today.withDayOfMonth(1).format(fmt), today.format(fmt))
            DashboardRange.CUSTOM -> {
                val state = _uiState.value
                Pair(state.customFromDate, state.customToDate)
            }
        }
    }
}
