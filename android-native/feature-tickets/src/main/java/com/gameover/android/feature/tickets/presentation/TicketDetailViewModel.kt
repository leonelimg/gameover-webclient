package com.gameover.android.feature.tickets.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.data.local.TokenDataStore
import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.domain.repository.FrontendSettingsRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.domain.util.PermissionChecker
import com.gameover.android.feature.bluetooth.BluetoothPrinterManager
import com.gameover.android.feature.bluetooth.BtState
import com.gameover.android.feature.bluetooth.escpos.TicketFormatter
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
    private val drawsRepository: DrawsRepository,
    private val frontendSettingsRepository: FrontendSettingsRepository,
    private val bluetoothPrinterManager: BluetoothPrinterManager,
    private val tokenDataStore: TokenDataStore,
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
                val printerAddress = tokenDataStore.printerAddress.first().orEmpty()
                if (printerAddress.isBlank()) {
                    _uiState.update {
                        it.copy(
                            isMarkingPrinted = false,
                            error = "No hay impresora configurada. Ve a Configuración > Impresora Bluetooth.",
                        )
                    }
                    return@launch
                }
                if (!ensureConnectedToSavedPrinter(printerAddress)) {
                    _uiState.update {
                        it.copy(
                            isMarkingPrinted = false,
                            error = "No se pudo conectar a la impresora guardada.",
                        )
                    }
                    return@launch
                }

                val draw = runCatching { drawsRepository.getDraws().find { it.id == ticket.drawId } }.getOrNull()
                val sellerName = ticket.seller?.fullName
                    ?: currentUser?.fullName
                    ?: currentUser?.username
                    ?: "Caja"
                val appearanceSettings = runCatching { frontendSettingsRepository.getTicketAppearance() }.getOrNull()
                val data = TicketFormatter.format(
                    ticket = ticket,
                    draw = draw,
                    sellerName = sellerName,
                    ticketTitle = appearanceSettings?.ticketTitle ?: "GameOver Lotería",
                    footerNote = appearanceSettings?.footerNote.orEmpty(),
                    ticketCodeFontSize = appearanceSettings?.ticketCodeFontSize ?: 32,
                )
                val printResult = bluetoothPrinterManager.print(data)
                if (printResult.isFailure) {
                    _uiState.update {
                        it.copy(
                            isMarkingPrinted = false,
                            error = "Error al imprimir: ${printResult.exceptionOrNull()?.message ?: "desconocido"}",
                        )
                    }
                    return@launch
                }

                val updated = ticketsRepository.markPrinted(ticket.id)
                _uiState.update { it.copy(ticket = updated, isMarkingPrinted = false, operationSuccess = "Ticket impreso correctamente.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(isMarkingPrinted = false, error = e.message) }
            }
        }
    }

    private suspend fun ensureConnectedToSavedPrinter(printerAddress: String): Boolean {
        val currentConnection = bluetoothPrinterManager.connectionState.value as? BtState.Connected
        if (currentConnection?.deviceAddress.equals(printerAddress, ignoreCase = true)) {
            return true
        }
        val device = bluetoothPrinterManager.findPairedDevice(printerAddress) ?: return false
        return bluetoothPrinterManager.connect(device)
    }

    fun clearOperationResult() = _uiState.update { it.copy(operationSuccess = null, error = null) }
}
