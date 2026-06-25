package com.gameover.android.feature.tickets.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.domain.util.DateFormatter
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.GoNeutral
import com.gameover.android.core.ui.theme.GoBlue
import com.gameover.android.core.ui.theme.GoSuccess

import androidx.compose.ui.platform.LocalContext
import com.gameover.android.core.ui.theme.GoSuccessDark
import com.gameover.android.feature.bluetooth.escpos.TicketImageGenerator
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketDetailScreen(
    onBack: () -> Unit,
    viewModel: TicketDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(uiState.operationSuccess, uiState.error) {
        uiState.operationSuccess?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearOperationResult()
        }
        uiState.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearOperationResult()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalle de Ticket") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                uiState.isLoading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.ticket != null -> {
                    TicketDetailContent(
                        ticket = uiState.ticket!!,
                        canCancel = uiState.canCancel,
                        isMarkingPrinted = uiState.isMarkingPrinted,
                        isCanceling = uiState.isCanceling,
                        fromWinningReport = uiState.fromWinningReport,
                        isPaying = uiState.isPaying,
                        onReprint = viewModel::markPrinted,
                        onShareWhatsapp = {
                            scope.launch {
                                val lines = viewModel.getTicketLinesForSharing()
                                if (lines != null) {
                                    TicketImageGenerator.shareTicketAsImage(context, lines)
                                }
                            }
                        },
                        onCancelClick = viewModel::showCancelDialog,
                        onPayClick = viewModel::markTicketAsPaid,
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                    )
                }
                else -> {
                    ErrorBanner(message = uiState.error ?: "Ticket no encontrado")
                }
            }

            if (uiState.cancelDialog) {
                AlertDialog(
                    onDismissRequest = viewModel::hideCancelDialog,
                    title = { Text("Anular Ticket") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("¿Estás seguro de que deseas anular este ticket?")
                            GoTextField(
                                value = uiState.cancelReason,
                                onValueChange = viewModel::onCancelReasonChanged,
                                label = "Motivo (opcional, max 300)",
                                singleLine = false,
                            )
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = viewModel::cancelTicket) {
                            Text("Anular", color = MaterialTheme.colorScheme.error)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = viewModel::hideCancelDialog) { Text("Cancelar") }
                    },
                )
            }
        }
    }
}

@Composable
private fun TicketDetailContent(
    ticket: Ticket,
    canCancel: Boolean,
    isMarkingPrinted: Boolean,
    isCanceling: Boolean,
    fromWinningReport: Boolean,
    isPaying: Boolean,
    onReprint: () -> Unit,
    onShareWhatsapp: () -> Unit,
    onCancelClick: () -> Unit,
    onPayClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header
        GoCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(text = ticket.code, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    ticket.draw?.let { Text(text = it.name, fontSize = 14.sp, color = GoNeutral) }
                    ticket.seller?.let { Text(text = "Vendedor: ${it.fullName}", fontSize = 12.sp, color = GoNeutral) }
                    Text(text = "Fecha: ${DateFormatter.format(ticket.createdAt)}", fontSize = 12.sp, color = GoNeutral)
                }
                Column(horizontalAlignment = Alignment.End) {
                    PaymentStatusBadge(status = ticket.paymentStatus.name, isCanceled = ticket.canceledAt != null)
                }
            }
        }

        // Lines table
        GoCard {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Números", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Divider()
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text("Núm.", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = GoNeutral)
                    if (ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }) {
                        Text("Especial", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = GoNeutral)
                    }
                    Text("Monto", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = GoNeutral)
                }
                ticket.lines.forEach { line ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text(line.number, modifier = Modifier.weight(1f), fontSize = 13.sp)
                        if (ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }) {
                            Text(CurrencyFormatter.format(line.specialAmount ?: 0.0), modifier = Modifier.weight(1f), fontSize = 13.sp)
                        }
                        Text(CurrencyFormatter.format(line.amount), modifier = Modifier.weight(1f), fontSize = 13.sp)
                    }
                }
                Divider()
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text("Total: ", fontWeight = FontWeight.Medium)
                    Text(CurrencyFormatter.format(ticket.total), fontWeight = FontWeight.Bold)
                }
            }
        }

        // Action buttons
        if (ticket.canceledAt == null) {
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GoButton(
                        text = "Reimprimir",
                        onClick = onReprint,
                        modifier = Modifier.weight(1f),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = GoBlue,
                        contentColor = Color.White,
                        trailingIcon = Icons.Default.Bluetooth,
                        loading = isMarkingPrinted,
                    )
                    GoButton(
                        text = "WhatsApp",
                        onClick = onShareWhatsapp,
                        modifier = Modifier.weight(1f),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = GoSuccessDark,
                        contentColor = Color.White,
                        trailingIcon = Icons.Default.Share,
                    )
                }
                if (fromWinningReport && ticket.paymentStatus.name == "pendiente") {
                    GoButton(
                        text = "Pagar Ticket",
                        onClick = onPayClick,
                        modifier = Modifier.fillMaxWidth(),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = GoSuccess,
                        contentColor = Color.White,
                        trailingIcon = Icons.Default.CheckCircle,
                        loading = isPaying,
                    )
                }
                if (canCancel) {
                    GoButton(
                        text = "Anular Ticket",
                        onClick = onCancelClick,
                        modifier = Modifier.fillMaxWidth(),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = Color.White,
                        loading = isCanceling,
                    )
                }
            }
        } else {
            ticket.cancelReason?.let {
                Text("Motivo de anulación: $it", fontSize = 12.sp, color = GoNeutral)
            }
        }
    }
}
