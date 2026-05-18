package com.gameover.android.feature.tickets.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.feature.tickets.TicketRules
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class TicketsViewModel(
    private val businessApi: BusinessApi
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<String>>(ResultState.Success(""))
    val state: StateFlow<ResultState<String>> = _state

    fun reprint(ticketId: String, canceledAt: String?) {
        if (!TicketRules.canReprint(canceledAt)) {
            _state.value = ResultState.Error(AppError.Validation("No se puede imprimir un ticket anulado"))
            return
        }

        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                businessApi.markTicketPrinted(ticketId)
                ResultState.Success("Ticket marcado como impreso")
            }.getOrElse {
                ResultState.Error(AppError.Unknown(it.message ?: "No se pudo reimprimir"))
            }
        }
    }

    fun cancel(ticketId: String, reason: String?) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                businessApi.cancelTicket(ticketId, mapOf("reason" to TicketRules.cancelReason(reason)))
                ResultState.Success("Ticket anulado")
            }.getOrElse {
                ResultState.Error(AppError.Unknown(it.message ?: "No se pudo anular"))
            }
        }
    }
}
