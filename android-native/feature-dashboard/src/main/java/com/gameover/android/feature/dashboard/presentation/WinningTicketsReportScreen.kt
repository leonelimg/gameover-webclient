package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.WinningTicket
import com.gameover.android.core.domain.model.WinningTicketsReport
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.domain.util.DateFormatter
import com.gameover.android.core.ui.component.ErrorBanner
import com.gameover.android.core.ui.theme.*
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WinningTicketsReportScreen(
    onBack: () -> Unit,
    onTicketClick: (String) -> Unit,
    viewModel: WinningTicketsReportViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.operationSuccess) {
        uiState.operationSuccess?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearOperationResult()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Pago de Tickets",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    actionIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = uiState.isLoading,
            onRefresh = viewModel::refresh,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 1. Date Range Chips Selector
                item {
                    RangeSelector(
                        selected = uiState.selectedRange,
                        onSelect = viewModel::onRangeSelected,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }

                // 2. Custom Date Range Row
                if (uiState.selectedRange == DashboardRange.CUSTOM) {
                    item {
                        CustomDateRangeRow(
                            fromDate = uiState.customFromDate,
                            toDate = uiState.customToDate,
                            onDateChanged = viewModel::onCustomDateChanged,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }
                }

                // 3. Draw Selector Dropdown
                item {
                    DrawDropdownSelector(
                        draws = uiState.draws,
                        selectedDrawId = uiState.selectedDrawId,
                        onDrawSelected = viewModel::onDrawSelected,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }

                // 4. Error Display
                if (uiState.error != null) {
                    item {
                        ErrorBanner(
                            message = uiState.error!!,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }
                }

                // 5. Loading State (if no report but loading)
                if (uiState.isLoading && uiState.report == null) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                } else {
                    val report = uiState.report
                    if (report != null) {
                        // 6. Prominent Winner Number Banner
                        item {
                            WinnerNumberCard(
                                name = report.draw.name,
                                winnerNumber = report.draw.winnerNumber,
                                hasWinnerNumber = report.draw.hasWinnerNumber,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                            )
                        }

                        // 7. Summary / KPIs Section
                        item {
                            WinningKpisSection(
                                totals = report.totals,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                            )
                        }

                        // 8. Winning Tickets List Header
                        item {
                            Text(
                                text = "Pago de Tickets (${report.tickets.size})",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }

                        // 9. List of Tickets
                        if (report.tickets.isEmpty()) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "No se encontraron tickets ganadores para este sorteo",
                                        color = GoNeutral,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        } else {
                            items(report.tickets) { ticket ->
                                WinningTicketRow(
                                    ticket = ticket,
                                    onClick = { onTicketClick(ticket.ticketId) },
                                    onMarkPaid = { viewModel.markTicketAsPaid(ticket.ticketId) },
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                                )
                            }
                        }
                    } else if (uiState.selectedDrawId != null) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No hay datos cargados para este sorteo", color = GoNeutral)
                            }
                        }
                    } else {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Seleccione un sorteo para ver los tickets ganadores", color = GoNeutral)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RangeSelector(
    selected: DashboardRange,
    onSelect: (DashboardRange) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val ranges = listOf(
            DashboardRange.TODAY to "Hoy",
            DashboardRange.WEEK to "Semana",
            DashboardRange.MONTH to "Mes",
            DashboardRange.CUSTOM to "Otra Fecha"
        )
        ranges.forEach { (range, label) ->
            FilterChip(
                selected = selected == range,
                onClick = { onSelect(range) },
                label = { Text(label) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DrawDropdownSelector(
    draws: List<Draw>,
    selectedDrawId: String?,
    onDrawSelected: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDraw = draws.find { it.id == selectedDrawId }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selectedDraw?.name ?: "Seleccione un sorteo",
            onValueChange = {},
            readOnly = true,
            label = { Text("Sorteo") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            if (draws.isEmpty()) {
                DropdownMenuItem(
                    text = { Text("No hay sorteos en este rango", color = GoNeutral) },
                    onClick = { expanded = false }
                )
            } else {
                draws.forEach { draw ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(draw.name, fontWeight = FontWeight.Bold)
                                Text(
                                    text = DateFormatter.format(draw.closeTime),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        onClick = {
                            onDrawSelected(draw.id)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun WinnerNumberCard(
    name: String,
    winnerNumber: String?,
    hasWinnerNumber: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (hasWinnerNumber) "Sorteo Finalizado" else "Sorteo en curso",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "NÚMERO GANADOR",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = winnerNumber ?: "--",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }
    }
}

@Composable
private fun WinningKpisSection(
    totals: com.gameover.android.core.domain.model.WinningTicketsTotals,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(
                label = "Total a Pagar",
                amount = totals.totalToPay,
                borderColor = GoBlue,
                modifier = Modifier.weight(1f)
            )
            KpiCard(
                label = "Total Pagado",
                amount = totals.totalPaid,
                borderColor = GoSuccess,
                modifier = Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(
                label = "Total Pendiente",
                amount = totals.totalPending,
                borderColor = GoDanger,
                modifier = Modifier.weight(1f)
            )
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(72.dp),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, GoGold.copy(alpha = 0.5f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Ganadores / Pagados",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${totals.winnersCount} tkt (${totals.paidCount} pag)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

@Composable
private fun KpiCard(
    label: String,
    amount: Double,
    borderColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.height(72.dp),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, borderColor.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = CurrencyFormatter.format(amount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
private fun WinningTicketRow(
    ticket: WinningTicket,
    onClick: () -> Unit,
    onMarkPaid: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isPaid = ticket.paymentStatus == "pagado"
    val statusColor = if (isPaid) GoSuccess else GoDanger
    val statusLabel = if (isPaid) "PAGADO" else "PENDIENTE"

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Icon(
                        imageVector = Icons.Default.ConfirmationNumber,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = ticket.code,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!isPaid) {
                        Button(
                            onClick = onMarkPaid,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GoSuccess,
                                contentColor = Color.White
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Pagar", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Surface(
                        color = statusColor.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(4.dp),
                        border = BorderStroke(0.5.dp, statusColor.copy(alpha = 0.5f))
                    ) {
                        Text(
                            text = statusLabel,
                            color = statusColor,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(
                        text = "Cliente: ${ticket.customerName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "Vendedor: ${ticket.seller.fullName} (@${ticket.seller.username})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "Fecha: ${DateFormatter.format(ticket.createdAt)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (ticket.winningNumbers.isNotEmpty()) {
                        Text(
                            text = "Números: ${ticket.winningNumbers.joinToString(", ")}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Text(
                    text = CurrencyFormatter.format(ticket.prizeAmount),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun CustomDateRangeRow(
    fromDate: String,
    toDate: String,
    onDateChanged: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        var showFromPicker by remember { mutableStateOf(false) }
        var showToPicker by remember { mutableStateOf(false) }

        if (showFromPicker) {
            GoDatePickerDialog(
                initialDate = fromDate,
                onDateSelected = { onDateChanged(it, toDate) },
                onDismiss = { showFromPicker = false }
            )
        }

        if (showToPicker) {
            GoDatePickerDialog(
                initialDate = toDate,
                onDateSelected = { onDateChanged(fromDate, it) },
                onDismiss = { showToPicker = false }
            )
        }

        Box(modifier = Modifier.weight(1f)) {
            OutlinedTextField(
                value = fromDate,
                onValueChange = { },
                readOnly = true,
                label = { Text("Desde") },
                placeholder = { Text("YYYY-MM-DD") },
                trailingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null, modifier = Modifier.size(18.dp)) },
                modifier = Modifier.fillMaxWidth()
            )
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clickable { showFromPicker = true }
            )
        }

        Box(modifier = Modifier.weight(1f)) {
            OutlinedTextField(
                value = toDate,
                onValueChange = { },
                readOnly = true,
                label = { Text("Hasta") },
                placeholder = { Text("YYYY-MM-DD") },
                trailingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null, modifier = Modifier.size(18.dp)) },
                modifier = Modifier.fillMaxWidth()
            )
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clickable { showToPicker = true }
            )
        }
    }
}

@Composable
private fun GoDatePickerDialog(
    initialDate: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val calendar = Calendar.getInstance()

    if (initialDate.isNotBlank()) {
        try {
            val date = java.time.LocalDate.parse(initialDate)
            calendar.set(date.year, date.monthValue - 1, date.dayOfMonth)
        } catch (e: Exception) {
            // Use current date if parsing fails
        }
    }

    val year = calendar.get(Calendar.YEAR)
    val month = calendar.get(Calendar.MONTH)
    val day = calendar.get(Calendar.DAY_OF_MONTH)

    DisposableEffect(Unit) {
        val dialog = android.app.DatePickerDialog(
            context,
            { _, selectedYear, selectedMonth, selectedDayOfMonth ->
                val date = java.time.LocalDate.of(selectedYear, selectedMonth + 1, selectedDayOfMonth)
                onDateSelected(date.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE))
                onDismiss()
            },
            year,
            month,
            day
        )
        dialog.setOnDismissListener { onDismiss() }
        dialog.show()

        onDispose {
            dialog.dismiss()
        }
    }
}
