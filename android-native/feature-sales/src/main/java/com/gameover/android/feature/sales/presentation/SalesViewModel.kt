package com.gameover.android.feature.sales.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.repository.CreateTicketLine
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.OfflineQueueRepository
import com.gameover.android.core.domain.usecase.CreateTicketUseCase
import com.gameover.android.core.domain.usecase.EnqueueOfflineSaleUseCase
import com.gameover.android.core.ui.util.NetworkMonitor
import com.google.gson.Gson
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SalesViewModel @Inject constructor(
    private val drawsRepository: DrawsRepository,
    private val createTicketUseCase: CreateTicketUseCase,
    private val enqueueOfflineSaleUseCase: EnqueueOfflineSaleUseCase,
    private val offlineQueueRepository: OfflineQueueRepository,
    private val networkMonitor: NetworkMonitor,
    private val gson: Gson,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SalesUiState())
    val uiState: StateFlow<SalesUiState> = _uiState.asStateFlow()

    init {
        loadDraws()
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                _uiState.update { it.copy(isOnline = online) }
            }
        }
        viewModelScope.launch {
            offlineQueueRepository.getPendingCount().collect { count ->
                _uiState.update { it.copy(pendingCount = count) }
            }
        }
    }

    fun loadDraws() {
        _uiState.update { it.copy(isLoadingDraws = true) }
        viewModelScope.launch {
            try {
                val draws = drawsRepository.getDraws()
                _uiState.update { state ->
                    val firstOpen = draws.firstOrNull { it.isOpen() }
                    val selectedId = if (draws.any { it.id == state.selectedDrawId }) state.selectedDrawId
                                     else firstOpen?.id ?: ""
                    state.copy(draws = draws, selectedDrawId = selectedId, isLoadingDraws = false)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoadingDraws = false) }
            }
        }
    }

    fun onDrawSelected(drawId: String) {
        _uiState.update { it.copy(selectedDrawId = drawId) }
    }

    fun onCustomerNameChanged(name: String) {
        _uiState.update { it.copy(customerName = name) }
    }

    fun onLineNumberChanged(id: String, number: String) {
        _uiState.update { state ->
            state.copy(lines = state.lines.map { if (it.id == id) it.copy(number = number) else it })
        }
    }

    fun onLineAmountChanged(id: String, amount: String) {
        _uiState.update { state ->
            state.copy(lines = state.lines.map { if (it.id == id) it.copy(amount = amount) else it })
        }
    }

    fun onLineSpecialAmountChanged(id: String, specialAmount: String) {
        _uiState.update { state ->
            state.copy(lines = state.lines.map { if (it.id == id) it.copy(specialAmount = specialAmount) else it })
        }
    }

    fun addLine() {
        _uiState.update { state ->
            val lastAmount = state.lines.lastOrNull { it.amount.isNotBlank() }?.amount ?: ""
            state.copy(lines = state.lines + SaleLine(amount = lastAmount))
        }
    }

    fun removeLine(id: String) {
        _uiState.update { state ->
            if (state.lines.size <= 1) state
            else state.copy(lines = state.lines.filter { it.id != id })
        }
    }

    fun clearLastTicket() {
        _uiState.update { it.copy(lastTicket = null, saleResult = SaleResult.Idle) }
    }

    fun sell() {
        val state = _uiState.value
        val draw = state.selectedDraw

        if (draw == null) {
            _uiState.update { it.copy(saleResult = SaleResult.Error("Selecciona un sorteo abierto.")) }
            return
        }
        if (!draw.isOpen()) {
            _uiState.update { it.copy(saleResult = SaleResult.Error("El sorteo no está en horario de venta.")) }
            return
        }
        val numberRegex = Regex("^\\d{2}$")
        for (line in state.lines) {
            if (!numberRegex.matches(line.number.trim())) {
                _uiState.update { it.copy(saleResult = SaleResult.Error("Todos los números deben tener exactamente 2 dígitos.")) }
                return
            }
            val amt = line.amount.toDoubleOrNull()
            if (amt == null || amt <= 0) {
                _uiState.update { it.copy(saleResult = SaleResult.Error("Todos los montos deben ser mayores a cero.")) }
                return
            }
            if (draw.specialMultiplier != null) {
                val special = line.specialAmount.toDoubleOrNull() ?: 0.0
                if (special < 0) {
                    _uiState.update { it.copy(saleResult = SaleResult.Error("El monto especial no puede ser negativo.")) }
                    return
                }
                if (special > amt) {
                    _uiState.update { it.copy(saleResult = SaleResult.Error("El monto especial del número ${line.number} no puede superar el monto regular.")) }
                    return
                }
            }
        }

        val ticketLines = state.lines.map { line ->
            CreateTicketLine(
                number = line.number.trim(),
                amount = line.amount.toDouble(),
                specialAmount = if (draw.specialMultiplier != null) (line.specialAmount.toDoubleOrNull() ?: 0.0) else null,
                isNicaEspecial = false,
            )
        }

        _uiState.update { it.copy(saleResult = SaleResult.Loading) }

        viewModelScope.launch {
            if (!_uiState.value.isOnline) {
                enqueueOfflineSale(draw.id, state.customerName, ticketLines)
                return@launch
            }

            val result = createTicketUseCase(draw.id, state.customerName, ticketLines)
            result.fold(
                onSuccess = { ticket ->
                    _uiState.update {
                        it.copy(
                            saleResult = SaleResult.Success(ticket),
                            lastTicket = ticket,
                            customerName = "",
                            lines = listOf(SaleLine()),
                        )
                    }
                },
                onFailure = { error ->
                    if (isNetworkError(error)) {
                        enqueueOfflineSale(draw.id, state.customerName, ticketLines)
                    } else {
                        // API error — preserve form, show error, allow retry
                        _uiState.update { it.copy(saleResult = SaleResult.Error(error.message ?: "Error al registrar la venta.")) }
                    }
                },
            )
        }
    }

    private suspend fun enqueueOfflineSale(drawId: String, customerName: String, lines: List<CreateTicketLine>) {
        val linesJson = gson.toJson(lines)
        enqueueOfflineSaleUseCase(drawId, customerName, linesJson)
        _uiState.update {
            it.copy(saleResult = SaleResult.Offline("Venta guardada. Se enviará cuando haya conexión."))
        }
    }

    private fun isNetworkError(error: Throwable): Boolean {
        return error is java.net.ConnectException ||
               error is java.net.SocketTimeoutException ||
               error is java.net.UnknownHostException ||
               error.message?.contains("Unable to resolve host") == true ||
               error.message?.contains("timeout") == true
    }

    fun clearError() {
        if (_uiState.value.saleResult is SaleResult.Error) {
            _uiState.update { it.copy(saleResult = SaleResult.Idle) }
        }
    }
}
