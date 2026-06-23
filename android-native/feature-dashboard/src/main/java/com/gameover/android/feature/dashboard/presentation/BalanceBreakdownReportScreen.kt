package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
fun BalanceBreakdownReportScreen(
    onBack: () -> Unit,
    viewModel: BalanceBreakdownReportViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val expandedAssociates = remember { mutableStateOf(setOf<String>()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Desglose de Balance",
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

                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        DrawDropdownSelector(
                            draws = uiState.draws,
                            selectedDrawId = uiState.selectedDrawId,
                            onDrawSelected = viewModel::onDrawSelected
                        )
                        UserDropdownSelector(
                            users = uiState.users,
                            selectedUserId = uiState.selectedUserId,
                            onUserSelected = viewModel::onUserSelected
                        )
                        Button(
                            onClick = { 
                                viewModel.clearFilters()
                                expandedAssociates.value = emptySet()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondaryContainer, contentColor = MaterialTheme.colorScheme.onSecondaryContainer)
                        ) {
                            Text("Limpiar filtros", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                if (uiState.error != null) {
                    item {
                        ErrorBanner(message = uiState.error!!, modifier = Modifier.padding(horizontal = 16.dp))
                    }
                }

                uiState.report?.let { rep ->
                    item {
                        Column(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                BreakdownKpiCard(
                                    label = "Vendido",
                                    amount = rep.totals.totalSales,
                                    borderColor = GoBlue,
                                    modifier = Modifier.weight(1f)
                                )
                                BreakdownKpiCard(
                                    label = "Premios",
                                    amount = rep.totals.totalPrizes,
                                    borderColor = GoGold,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                BreakdownKpiCard(
                                    label = "Comisión",
                                    amount = rep.totals.totalCommissions,
                                    borderColor = GoGoldLight, // represented by purple/violet style border
                                    modifier = Modifier.weight(1f)
                                )
                                BreakdownKpiCard(
                                    label = "Balance",
                                    amount = rep.totals.balance,
                                    borderColor = if (rep.totals.balance >= 0) GoSuccess else GoDanger,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    item {
                        Text(
                            text = "Desglose por Asociado",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }


                    // Filter and render visible rows
                    val visibleRows = rep.rows.filter { isRowVisible(it, rep.rows, expandedAssociates.value) }
                    
                    if (visibleRows.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No hay registros", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    } else {
                        items(visibleRows) { associate ->
                            val isExpanded = expandedAssociates.value.contains(associate.associateId)
                            AssociateRowCard(
                                associate = associate,
                                isExpanded = isExpanded,
                                onToggle = {
                                    expandedAssociates.value = if (isExpanded) {
                                        expandedAssociates.value - associate.associateId
                                    } else {
                                        expandedAssociates.value + associate.associateId
                                    }
                                }
                            )
                            if (isExpanded) {
                                associate.draws.forEach { draw ->
                                    DrawRowCard(draw = draw)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun isRowVisible(
    row: AssociateBreakdownRow,
    rows: List<AssociateBreakdownRow>,
    expandedIds: Set<String>
): Boolean {
    if (row.parentId == null) return true
    val parentRow = rows.find { it.associateId == row.parentId } ?: return true
    return expandedIds.contains(row.parentId) && isRowVisible(parentRow, rows, expandedIds)
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
    onDrawSelected: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDraw = draws.find { it.id == selectedDrawId }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selectedDraw?.name ?: "Todos los sorteos",
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
            DropdownMenuItem(
                text = { Text("Todos los sorteos", fontWeight = FontWeight.Bold) },
                onClick = {
                    onDrawSelected(null)
                    expanded = false
                }
            )
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UserDropdownSelector(
    users: List<User>,
    selectedUserId: String?,
    onUserSelected: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedUser = users.find { it.id == selectedUserId }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selectedUser?.let { "${it.fullName} (${it.username})" } ?: "Todos los usuarios",
            onValueChange = {},
            readOnly = true,
            label = { Text("Usuario Vendedor") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            DropdownMenuItem(
                text = { Text("Todos los usuarios", fontWeight = FontWeight.Bold) },
                onClick = {
                    onUserSelected(null)
                    expanded = false
                }
            )
            users.forEach { user ->
                val roleLabel = when (user.role.name) {
                    "vendedor" -> "Vendedor"
                    "asociado" -> "Asociado"
                    else -> "Admin"
                }
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(user.fullName, fontWeight = FontWeight.Bold)
                            Text(
                                text = "@${user.username} ($roleLabel)",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    onClick = {
                        onUserSelected(user.id)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun BreakdownKpiCard(
    label: String,
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
private fun AssociateRowCard(
    associate: AssociateBreakdownRow,
    isExpanded: Boolean,
    onToggle: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .clickable { onToggle() }
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = associate.associateName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
                Text(
                    text = CurrencyFormatter.format(associate.balance),
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 14.sp,
                    color = if (associate.balance >= 0) GoSuccess else GoDanger
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Tickets", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(associate.ticketCount.toString(), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Venta", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(associate.totalSales), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Premios", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(associate.totalPrizes), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Comisión", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(associate.totalCommissions), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun DrawRowCard(draw: AssociateDrawBreakdownRow) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 32.dp, end = 16.dp, top = 2.dp, bottom = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            val lastTicketCreatedAt = draw.lastTicketCreatedAt
            val drawLabel = if (!lastTicketCreatedAt.isNullOrBlank()) {
                "${draw.drawName} · ${DateFormatter.format(lastTicketCreatedAt)}"
            } else {
                draw.drawName
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = drawLabel,
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = CurrencyFormatter.format(draw.balance),
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = if (draw.balance >= 0) GoSuccess else GoRed
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Tickets", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(draw.ticketCount.toString(), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Venta", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(draw.totalSales), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Premios", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(draw.totalPrizes), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Comisión", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(CurrencyFormatter.format(draw.totalCommissions), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
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
