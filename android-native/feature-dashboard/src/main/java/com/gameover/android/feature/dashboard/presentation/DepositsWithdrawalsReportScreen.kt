package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.*
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.domain.util.DateFormatter
import com.gameover.android.core.ui.component.ErrorBanner
import com.gameover.android.core.ui.component.ErrorBanner
import com.gameover.android.core.ui.theme.*
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DepositsWithdrawalsReportScreen(
    onBack: () -> Unit,
    viewModel: DepositsWithdrawalsReportViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Depósitos y Retiros",
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
    ) { paddingValues ->
        PullToRefreshBox(
            isRefreshing = uiState.isLoading,
            onRefresh = viewModel::refresh,
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize(),
            contentPadding = PaddingValues(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                RangeSelector(
                    selected = uiState.selectedRange,
                    onSelect = viewModel::onRangeSelected,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

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

            if (uiState.targets.size > 1) {
                item {
                    TargetUserSelector(
                        targets = uiState.targets,
                        selectedTargetId = uiState.selectedTargetId,
                        onTargetSelected = viewModel::onTargetSelected,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }
            }

            if (uiState.error != null) {
                item {
                    ErrorBanner(message = uiState.error!!, modifier = Modifier.padding(horizontal = 16.dp))
                }
            }

            uiState.balance?.let { bal ->
                item {
                    Text(
                        text = "Balance operativo",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }
                item {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            BalanceCard(
                                title = "Saldo Anterior",
                                amount = bal.totals.openingBalance,
                                borderColor = if (bal.totals.openingBalance >= 0) GoSuccess else GoDanger,
                                modifier = Modifier.weight(1f)
                            )
                            BalanceCard(
                                title = "Balance Final",
                                amount = bal.totals.balance,
                                borderColor = if (bal.totals.balance >= 0) GoSuccess else GoDanger,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            BalanceCard(
                                title = "Depósitos",
                                amount = bal.totals.totalDeposits,
                                borderColor = GoSuccess,
                                modifier = Modifier.weight(1f)
                            )
                            BalanceCard(
                                title = "Retiros",
                                amount = bal.totals.totalWithdrawals,
                                borderColor = GoDanger,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            BalanceCard(
                                title = "Ventas",
                                amount = bal.totals.totalSales,
                                borderColor = GoBlue,
                                modifier = Modifier.weight(1f)
                            )
                            BalanceCard(
                                title = "Premios",
                                amount = bal.totals.totalPrizes,
                                borderColor = GoGold,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            item {
                TabRow(
                    selectedTabIndex = uiState.selectedTabIndex,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                ) {
                    Tab(
                        selected = uiState.selectedTabIndex == 0,
                        onClick = { viewModel.onTabSelected(0) },
                        text = { Text("Movimientos", fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = uiState.selectedTabIndex == 1,
                        onClick = { viewModel.onTabSelected(1) },
                        text = { Text("Por Evento", fontWeight = FontWeight.Bold) }
                    )
                }
            }

            if (uiState.isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
            } else {
                if (uiState.selectedTabIndex == 0) {
                    if (uiState.historyItems.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No hay movimientos registrados", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    } else {
                        items(uiState.historyItems) { item ->
                            MovementListItem(item = item)
                        }
                    }
                } else {
                    val summary = uiState.eventSummary
                    if (summary == null || summary.rows.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No hay eventos registrados", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    } else {
                        item {
                            EventSummaryBlock(totals = summary.totals)
                        }
                        items(summary.rows) { row ->
                            EventRowItem(row = row)
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
private fun TargetUserSelector(
    targets: List<CashMovementTarget>,
    selectedTargetId: String?,
    onTargetSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedTarget = targets.find { it.id == selectedTargetId }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selectedTarget?.let { "${it.fullName} (${it.username})" } ?: "Seleccione un usuario",
            onValueChange = {},
            readOnly = true,
            label = { Text("Usuario Destino") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            targets.forEach { target ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(target.fullName, fontWeight = FontWeight.Bold)
                            Text(
                                text = "@${target.username} (${target.role})",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    onClick = {
                        onTargetSelected(target.id)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun BalanceCard(
    title: String,
    amount: Double,
    borderColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp),
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
                text = title,
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
private fun MovementListItem(item: CashMovementHistoryItem) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val badgeColor = when (item.type) {
                        "deposito" -> GoSuccess
                        "venta" -> GoBlue
                        else -> GoDanger
                    }
                    Box(
                        modifier = Modifier
                            .background(badgeColor.copy(alpha = 0.15f), shape = RoundedCornerShape(4.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = item.type.uppercase(),
                            color = badgeColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                    if (item.canceledAt != null) {
                        Box(
                            modifier = Modifier
                                .background(GoWarning.copy(alpha = 0.15f), shape = RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "CANCELADO",
                                color = GoWarning,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
                val amountText = if (item.type == "retiro" || item.amount < 0) {
                    "-${CurrencyFormatter.format(Math.abs(item.amount))}"
                } else {
                    CurrencyFormatter.format(item.amount)
                }
                val amountColor = when (item.type) {
                    "deposito" -> GoSuccess
                    "venta" -> GoBlue
                    else -> GoDanger
                }
                Text(
                    text = amountText,
                    fontWeight = FontWeight.Bold,
                    color = amountColor,
                    fontSize = 16.sp
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            val note = item.note
            if (!note.isNullOrBlank()) {
                Text(
                    text = note,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "Registrado por: ${item.createdBy.fullName}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = DateFormatter.format(item.createdAt),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                item.balanceAfterTransaction?.let { bal ->
                    Text(
                        text = "Saldo: ${CurrencyFormatter.format(bal)}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (bal >= 0) GoSuccess else GoDanger,
                        textAlign = TextAlign.End
                    )
                }
            }
        }
    }
}

@Composable
private fun EventSummaryBlock(totals: CashMovementEventSummaryTotals) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Resumen de Eventos", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Ventas:", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(CurrencyFormatter.format(totals.totalSales), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Premios:", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(CurrencyFormatter.format(totals.totalPrizes), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Comisión:", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(CurrencyFormatter.format(totals.totalCommissions), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            HorizontalDivider(thickness = 0.5.dp, color = Color.LightGray)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Balance:", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Text(
                    text = CurrencyFormatter.format(totals.balance),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = if (totals.balance >= 0) GoSuccess else GoDanger
                )
            }
        }
    }
}

@Composable
private fun EventRowItem(row: CashMovementEventSummaryRow) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = row.eventName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(
                    text = CurrencyFormatter.format(row.balance),
                    fontWeight = FontWeight.Bold,
                    color = if (row.balance >= 0) GoSuccess else GoDanger,
                    fontSize = 14.sp
                )
            }
            Text(
                text = DateFormatter.format(row.eventDate),
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 6.dp)
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Vendido", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(row.totalSales), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("Premios", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(row.totalPrizes), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("Comisión", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(row.totalCommissions), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = "Saldo Post: ${CurrencyFormatter.format(row.balanceAfterTransaction)}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (row.balanceAfterTransaction >= 0) GoSuccess else GoDanger
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
