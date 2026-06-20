package com.gameover.android.feature.sales.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.data.local.TokenDataStore
import com.gameover.android.core.domain.repository.CreateTicketLine
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.FrontendSettingsRepository
import com.gameover.android.core.domain.repository.OfflineQueueRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.domain.usecase.CreateTicketUseCase
import com.gameover.android.core.domain.usecase.EnqueueOfflineSaleUseCase
import com.gameover.android.core.ui.util.NetworkMonitor
import com.gameover.android.feature.bluetooth.BluetoothPrinterManager
import com.gameover.android.feature.bluetooth.BtState
import com.gameover.android.feature.bluetooth.escpos.TicketFormatter
import com.google.gson.Gson
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
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
    private val bluetoothPrinterManager: BluetoothPrinterManager,
    private val tokenDataStore: TokenDataStore,
    private val authRepository: AuthRepository,
    private val frontendSettingsRepository: FrontendSettingsRepository,
    private val ticketsRepository: TicketsRepository,
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
        _uiState.update { it.copy(lastTicket = null, saleResult = SaleResult.Idle, printStatusMessage = null, isPrintingTicket = false) }
    }

    fun clearPrintStatus() {
        _uiState.update { it.copy(printStatusMessage = null) }
    }

    fun printLastTicket() {
        val ticket = _uiState.value.lastTicket ?: return
        _uiState.update { it.copy(isPrintingTicket = true) }
        viewModelScope.launch {
            val printerAddress = tokenDataStore.printerAddress.first().orEmpty()
            if (printerAddress.isBlank()) {
                _uiState.update {
                    it.copy(
                        isPrintingTicket = false,
                        printStatusMessage = "No hay impresora configurada. Ve a Configuración > Impresora Bluetooth.",
                    )
                }
                return@launch
            }

            if (!ensureConnectedToSavedPrinter(printerAddress)) {
                _uiState.update {
                    it.copy(
                        isPrintingTicket = false,
                        printStatusMessage = "No se pudo conectar a la impresora guardada.",
                    )
                }
                return@launch
            }

            val draw = _uiState.value.draws.find { it.id == ticket.drawId }
            val currentUser = authRepository.getStoredUser().first()
            val sellerName = ticket.seller?.fullName
                ?: currentUser?.fullName
                ?: currentUser?.username
                ?: "Caja"
            val appearanceSettings = runCatching { frontendSettingsRepository.getTicketAppearance() }.getOrNull()
            val hasSpecialAmounts = ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }
            val specialMultiplier = draw?.specialMultiplier?.value ?: ticket.draw?.specialMultiplier?.value
            val drawUsesSpecial = specialMultiplier?.let { it > 0 } ?: hasSpecialAmounts
            val showSpecialColumn = drawUsesSpecial && hasSpecialAmounts
            val effectiveMultiplier = if (showSpecialColumn && specialMultiplier != null) specialMultiplier else null

            val data = TicketFormatter.format(
                ticket = ticket,
                draw = draw,
                sellerName = sellerName,
                ticketTitle = appearanceSettings?.ticketTitle ?: "GameOver Lotería",
                footerNote = appearanceSettings?.footerNote.orEmpty(),
                effectiveMultiplier = effectiveMultiplier,
                ticketCodeFontSize = appearanceSettings?.ticketCodeFontSize ?: 32,
            )
            val result = bluetoothPrinterManager.print(data)
            if (result.isSuccess) {
                val updated = runCatching { ticketsRepository.markPrinted(ticket.id) }.getOrNull()
                _uiState.update {
                    it.copy(
                        lastTicket = updated ?: ticket,
                        saleResult = SaleResult.Success(updated ?: ticket),
                        isPrintingTicket = false,
                        printStatusMessage = "Ticket impreso correctamente.",
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isPrintingTicket = false,
                        printStatusMessage = "Error al imprimir: ${result.exceptionOrNull()?.message ?: "desconocido"}",
                    )
                }
            }
        }
    }

    suspend fun getTicketLinesForSharing(): List<TicketFormatter.TicketTextLine>? {
        val ticket = _uiState.value.lastTicket ?: return null
        val draw = _uiState.value.draws.find { it.id == ticket.drawId }
        val currentUser = authRepository.getStoredUser().first()
        val sellerName = ticket.seller?.fullName
            ?: currentUser?.fullName
            ?: currentUser?.username
            ?: "Caja"
        val appearanceSettings = runCatching { frontendSettingsRepository.getTicketAppearance() }.getOrNull()
        val hasSpecialAmounts = ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }
        val specialMultiplier = draw?.specialMultiplier?.value ?: ticket.draw?.specialMultiplier?.value
        val drawUsesSpecial = specialMultiplier?.let { it > 0 } ?: hasSpecialAmounts
        val showSpecialColumn = drawUsesSpecial && hasSpecialAmounts
        val effectiveMultiplier = if (showSpecialColumn && specialMultiplier != null) specialMultiplier else null

        return TicketFormatter.getTicketLines(
            ticket = ticket,
            draw = draw,
            sellerName = sellerName,
            ticketTitle = appearanceSettings?.ticketTitle ?: "GameOver Lotería",
            footerNote = appearanceSettings?.footerNote.orEmpty(),
            effectiveMultiplier = effectiveMultiplier,
            ticketCodeFontSize = appearanceSettings?.ticketCodeFontSize ?: 32,
        )
    }

    fun sell() {
        val currentState = _uiState.value
        val draw = currentState.selectedDraw

        if (draw == null) {
            _uiState.update { it.copy(saleResult = SaleResult.Error("Selecciona un sorteo abierto.")) }
            return
        }
        if (!draw.isOpen()) {
            _uiState.update { it.copy(saleResult = SaleResult.Error("El sorteo no está en horario de venta.")) }
            return
        }

        // Clean up: remove lines that don't have a number defined
        val filteredLines = currentState.lines.filter { it.number.isNotBlank() }
        
        if (filteredLines.isEmpty()) {
            _uiState.update { it.copy(saleResult = SaleResult.Error("Debes ingresar al menos un número.")) }
            return
        }

        // Update state with filtered lines if any were removed
        if (filteredLines.size != currentState.lines.size) {
            _uiState.update { it.copy(lines = filteredLines) }
        }

        val numberRegex = Regex("^\\d{2}$")
        for (line in filteredLines) {
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

        val ticketLines = filteredLines.map { line ->
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
                enqueueOfflineSale(draw.id, currentState.customerName, ticketLines)
                return@launch
            }

            val result = createTicketUseCase(draw.id, currentState.customerName, ticketLines)
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
                        enqueueOfflineSale(draw.id, currentState.customerName, ticketLines)
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
               error.message?.contains("Unable to resolve host", ignoreCase = true) == true ||
               error.message?.contains("timeout", ignoreCase = true) == true ||
               error.message?.contains("network", ignoreCase = true) == true
    }

    private suspend fun ensureConnectedToSavedPrinter(printerAddress: String): Boolean {
        val currentConnection = bluetoothPrinterManager.connectionState.value as? BtState.Connected
        if (currentConnection?.deviceAddress.equals(printerAddress, ignoreCase = true)) {
            return true
        }
        val device = bluetoothPrinterManager.findPairedDevice(printerAddress) ?: return false
        return bluetoothPrinterManager.connect(device)
    }

    fun clearError() {
        if (_uiState.value.saleResult is SaleResult.Error) {
            _uiState.update { it.copy(saleResult = SaleResult.Idle) }
        }
    }
}
