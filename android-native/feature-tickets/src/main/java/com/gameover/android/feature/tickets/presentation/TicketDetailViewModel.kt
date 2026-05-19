package com.gameover.android.feature.tickets.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.domain.util.PermissionChecker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TicketDetailViewModel @Inject constructor(
    private val ticketsRepository: TicketsRepository,
    private val authRepository: AuthRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val ticketId: String = savedStateHandle["ticketId"] ?: ""

    private val _uiState = MutableStateFlow(TicketDetailUiState())
    val uiState: StateFlow<TicketDetailUiState> = _uiState.asStateFlow()

    private var currentUser: User? = null

    init {
        viewModelScope.launch {
            currentUser = authRepository.getStoredUser().first()
            loadTicket()
        }
    }

    fun canCancelTicket(): Boolean = currentUser?.let {
        PermissionChecker.hasPermission(it, "/sales:cancel")
    } ?: false

    fun loadTicket() {
        if (ticketId.isBlank()) return
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val ticket = ticketsRepository.getTicket(ticketId)
                _uiState.update { it.copy(ticket = ticket, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun showCancelDialog() = _uiState.update { it.copy(cancelDialog = true) }
    fun hideCancelDialog() = _uiState.update { it.copy(cancelDialog = false, cancelReason = "") }
    fun onCancelReasonChanged(reason: String) = _uiState.update { it.copy(cancelReason = reason) }

    fun cancelTicket() {
        val ticket = _uiState.value.ticket ?: return
        _uiState.update { it.copy(isCanceling = true, cancelDialog = false) }
        viewModelScope.launch {
            try {
                val updated = ticketsRepository.cancelTicket(ticket.id, _uiState.value.cancelReason.takeIf { it.isNotBlank() })
                _uiState.update { it.copy(ticket = updated, isCanceling = false, operationSuccess = "Ticket anulado correctamente.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isCanceling = false, error = e.message) }
            }
        }
    }

    fun markPrinted() {
        val ticket = _uiState.value.ticket ?: return
        if (ticket.canceledAt != null) return
        _uiState.update { it.copy(isMarkingPrinted = true) }
        viewModelScope.launch {
            try {
                val updated = ticketsRepository.markPrinted(ticket.id)
                _uiState.update { it.copy(ticket = updated, isMarkingPrinted = false, operationSuccess = "Ticket marcado como impreso.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isMarkingPrinted = false, error = e.message) }
            }
        }
    }

    fun clearOperationResult() = _uiState.update { it.copy(operationSuccess = null, error = null) }
}
