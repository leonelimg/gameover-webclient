package com.gameover.android.feature.tickets.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.bluetooth.BluetoothPrinterDevice
import com.gameover.android.core.bluetooth.BluetoothPrinterManager
import com.gameover.android.core.database.repository.PrinterDeviceRepository
import com.gameover.android.core.network.NetworkErrorMapper
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.TicketDto
import com.gameover.android.core.print.DetailLine
import com.gameover.android.core.print.EscPosTicket
import com.gameover.android.core.print.NativePrintQueueProcessor
import com.gameover.android.feature.tickets.TicketRules
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class TicketsViewModel(
    @Inject private val businessApi: BusinessApi,
    @Inject private val printQueueProcessor: NativePrintQueueProcessor,
    @Inject private val printerDeviceRepository: PrinterDeviceRepository,
    @Inject private val bluetoothPrinterManager: BluetoothPrinterManager
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<String>>(ResultState.Success(""))
    val state: StateFlow<ResultState<String>> = _state
    private val _tickets = MutableStateFlow<List<TicketDto>>(emptyList())
    val tickets: StateFlow<List<TicketDto>> = _tickets
    private val _selectedTicket = MutableStateFlow<TicketDto?>(null)
    val selectedTicket: StateFlow<TicketDto?> = _selectedTicket
    private val _printers = MutableStateFlow<List<BluetoothPrinterDevice>>(emptyList())
    val printers: StateFlow<List<BluetoothPrinterDevice>> = _printers

    fun load(drawId: String? = null, userId: String? = null, fromDate: String? = null, toDate: String? = null) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                val response = businessApi.salesByUser(drawId = drawId, userId = userId, fromDate = fromDate, toDate = toDate)
                _tickets.value = response.tickets
                ResultState.Success("Tickets cargados")
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo cargar tickets"))
            }
        }
    }

    fun loadDetail(ticketId: String) {
        viewModelScope.launch {
            _state.value = ResultState.Loading
            _state.value = runCatching {
                _selectedTicket.value = businessApi.ticketById(ticketId)
                ResultState.Success("Detalle cargado")
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo cargar detalle del ticket"))
            }
        }
    }

    fun reprint(ticketId: String, canceledAt: String?) {
        if (!TicketRules.canReprint(canceledAt)) {
            _state.value = ResultState.Error(AppError.Validation("No se puede imprimir un ticket anulado"))
            return
        }

        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                val ticket = businessApi.ticketById(ticketId)
                val printTicket = EscPosTicket(
                    title = "Ticket de Venta",
                    businessName = "GameOver Lotería",
                    ticketNumber = ticket.code,
                    dateIso = ticket.createdAt,
                    cashier = ticket.seller?.fullName ?: ticket.sellerId,
                    drawName = ticket.draw?.name ?: ticket.drawId,
                    detailLines = ticket.lines.map { line ->
                        val special = line.specialAmount ?: 0.0
                        DetailLine(
                            number = line.number,
                            regular = line.amount,
                            special = special,
                            total = line.amount + special
                        )
                    },
                    total = ticket.total,
                    notes = listOf("Cliente: ${ticket.customerName.ifBlank { "Consumidor final" }}"),
                    qrText = ticket.code
                )
                printQueueProcessor.enqueue(printTicket)
                printQueueProcessor.processQueue()
                businessApi.markTicketPrinted(ticketId)
                ResultState.Success("Ticket marcado como impreso")
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo reimprimir"))
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
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo anular"))
            }
        }
    }

    fun loadPrinters() {
        _printers.value = bluetoothPrinterManager.pairedPrinters()
    }

    fun selectPrinter(address: String, name: String) {
        viewModelScope.launch {
            printerDeviceRepository.save(address, name)
            _state.value = ResultState.Success("Impresora seleccionada: $name")
        }
    }
}
