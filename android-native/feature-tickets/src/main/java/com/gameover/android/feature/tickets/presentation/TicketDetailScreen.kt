package com.gameover.android.feature.tickets.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Print
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.GoNeutral

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketDetailScreen(
    onBack: () -> Unit,
    viewModel: TicketDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

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
                        canCancel = viewModel.canCancelTicket(),
                        isMarkingPrinted = uiState.isMarkingPrinted,
                        isCanceling = uiState.isCanceling,
                        onReprint = viewModel::markPrinted,
                        onCancelClick = viewModel::showCancelDialog,
                        modifier = Modifier.fillMaxSize(),
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
                                label = "Motivo (opcional)",
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
    onReprint: () -> Unit,
    onCancelClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header
        GoCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(text = ticket.code, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    ticket.draw?.let { Text(text = it.name, fontSize = 14.sp, color = GoNeutral) }
                    ticket.seller?.let { Text(text = "Vendedor: ${it.fullName}", fontSize = 12.sp, color = GoNeutral) }
                    Text(text = "Fecha: ${ticket.createdAt.take(10)}", fontSize = 12.sp, color = GoNeutral)
                }
                Column(horizontalAlignment = Alignment.End) {
                    PaymentStatusBadge(status = ticket.paymentStatus.name, isCanceled = ticket.canceledAt != null)
                }
            }
        }

        // Lines table
        GoCard {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Apuestas", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Divider()
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text("Núm.", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = GoNeutral)
                    Text("Regular", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = GoNeutral)
                    if (ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }) {
                        Text("Especial", modifier = Modifier.weight(1f), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = GoNeutral)
                    }
                }
                ticket.lines.forEach { line ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text(line.number, modifier = Modifier.weight(1f), fontSize = 13.sp)
                        Text(CurrencyFormatter.format(line.amount), modifier = Modifier.weight(1f), fontSize = 13.sp)
                        if (ticket.lines.any { (it.specialAmount ?: 0.0) > 0 }) {
                            Text(CurrencyFormatter.format(line.specialAmount ?: 0.0), modifier = Modifier.weight(1f), fontSize = 13.sp)
                        }
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
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GoButton(
                    text = "Reimprimir",
                    onClick = onReprint,
                    modifier = Modifier.weight(1f),
                    variant = ButtonVariant.OUTLINED,
                    loading = isMarkingPrinted,
                )
                if (canCancel) {
                    GoButton(
                        text = "Anular",
                        onClick = onCancelClick,
                        modifier = Modifier.weight(1f),
                        variant = ButtonVariant.OUTLINED,
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
