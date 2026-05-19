package com.gameover.android.feature.sales.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.database.repository.PendingSalesQueueRepository
import com.gameover.android.core.network.NetworkErrorMapper
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.CreateTicketRequest
import com.gameover.android.feature.sales.domain.PendingSalesSyncUseCase
import com.gameover.android.feature.sales.domain.PendingSalesQueuePolicy
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class SalesViewModel @Inject constructor(
    private val businessApi: BusinessApi,
    private val queueRepository: PendingSalesQueueRepository,
    private val pendingSyncUseCase: PendingSalesSyncUseCase
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<String>>(ResultState.Success(""))
    val state: StateFlow<ResultState<String>> = _state
    private val _queueStatus = MutableStateFlow("Pendientes: 0 | Fallidas: 0 | Sincronizadas: 0")
    val queueStatus: StateFlow<String> = _queueStatus

    private val payloadAdapter = Moshi.Builder().build().adapter(CreateTicketRequest::class.java)

    init {
        refreshQueueStatus()
    }

    fun submitSale(payload: CreateTicketRequest) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            val result = runCatching { businessApi.createTicket(payload) }
            _state.value = result.fold(
                onSuccess = { ResultState.Success("Venta registrada") },
                onFailure = { throwable ->
                    if (PendingSalesQueuePolicy.shouldQueueOffline(throwable)) {
                        queueRepository.enqueue(payloadAdapter.toJson(payload))
                        refreshQueueStatus()
                        ResultState.Success("Sin conexión: venta encolada para sincronizar")
                    } else {
                        ResultState.Error(NetworkErrorMapper.toAppError(throwable, "No se pudo registrar la venta"))
                    }
                }
            )
        }
    }

    fun syncPendingSales() {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                pendingSyncUseCase.syncAll()
                refreshQueueStatus()
                ResultState.Success("Sincronización finalizada")
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo sincronizar cola offline"))
            }
        }
    }

    fun refreshQueueStatus() {
        viewModelScope.launch {
            val pending = queueRepository.pendingOnly().size
            val failed = queueRepository.failedOnly().size
            val synced = queueRepository.syncedOnly().size
            _queueStatus.value = "Pendientes: $pending | Fallidas: $failed | Sincronizadas: $synced"
        }
    }
}
