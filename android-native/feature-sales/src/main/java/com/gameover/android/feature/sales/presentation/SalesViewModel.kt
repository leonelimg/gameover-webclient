package com.gameover.android.feature.sales.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.database.repository.PendingSalesQueueRepository
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.CreateTicketRequest
import com.gameover.android.feature.sales.domain.PendingSalesQueuePolicy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class SalesViewModel(
    private val businessApi: BusinessApi,
    private val queueRepository: PendingSalesQueueRepository
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<String>>(ResultState.Success(""))
    val state: StateFlow<ResultState<String>> = _state

    fun submitSale(payload: CreateTicketRequest, payloadJson: String) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            val result = runCatching { businessApi.createTicket(payload) }
            _state.value = result.fold(
                onSuccess = { ResultState.Success("Venta registrada") },
                onFailure = { throwable ->
                    if (PendingSalesQueuePolicy.shouldQueueOffline(throwable)) {
                        queueRepository.enqueue(payloadJson)
                        ResultState.Success("Sin conexión: venta encolada para sincronizar")
                    } else {
                        ResultState.Error(AppError.Validation(throwable.message ?: "No se pudo registrar la venta"))
                    }
                }
            )
        }
    }
}
