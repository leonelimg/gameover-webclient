package com.gameover.android.feature.dashboard.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material3.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.DashboardRange
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.domain.util.DateFormatter
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNotificationsClick: () -> Unit,
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Dashboard",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    IconButton(onClick = onNotificationsClick) {
                        BadgedBox(
                            badge = {
                                if (uiState.announcementCount > 0) {
                                    Badge {
                                        Text(uiState.announcementCount.toString())
                                    }
                                }
                            }
                        ) {
                            Icon(Icons.Default.Notifications, contentDescription = "Anuncios")
                        }
                    }
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    actionIconContentColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = uiState.isLoading,
            onRefresh = viewModel::refresh,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Range selector with better styling
                item {
                    RangeSelector(
                        selected = uiState.selectedRange,
                        onSelect = viewModel::onRangeSelected,
                    )
                }

                // No connection banner
                if (!uiState.isOnline) {
                    item {
                        NoConnectionBanner(isVisible = true, onRetry = { viewModel.refresh() })
                    }
                }

                // Custom date range inputs
                if (uiState.selectedRange == DashboardRange.CUSTOM) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            var showFromPicker by remember { mutableStateOf(false) }
                            var showToPicker by remember { mutableStateOf(false) }

                            if (showFromPicker) {
                                GoDatePickerDialog(
                                    initialDate = uiState.customFromDate,
                                    onDateSelected = { viewModel.onCustomDateChanged(it, uiState.customToDate) },
                                    onDismiss = { showFromPicker = false }
                                )
                            }

                            if (showToPicker) {
                                GoDatePickerDialog(
                                    initialDate = uiState.customToDate,
                                    onDateSelected = { viewModel.onCustomDateChanged(uiState.customFromDate, it) },
                                    onDismiss = { showToPicker = false }
                                )
                            }

                            Box(modifier = Modifier.weight(1f)) {
                                GoTextField(
                                    value = uiState.customFromDate,
                                    onValueChange = { },
                                    label = "Desde",
                                    placeholder = "YYYY-MM-DD",
                                    readOnly = true,
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
                                GoTextField(
                                    value = uiState.customToDate,
                                    onValueChange = { },
                                    label = "Hasta",
                                    placeholder = "YYYY-MM-DD",
                                    readOnly = true,
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
                }

                // Error banner
                if (!uiState.error.isNullOrBlank()) {
                    item { ErrorBanner(message = uiState.error) }
                }

                // KPI Summary
                uiState.summary?.let { summary ->
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            KpiSection(summary = summary, finalBalance = uiState.finalBalance)
                            if (uiState.recentTickets.isNotEmpty()) {
                                Text(
                                    "Tickets Recientes",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 16.sp,
                                    style = MaterialTheme.typography.titleMedium
                                )
                            }
                        }
                    }
                }

                // Empty state
                if (!uiState.isLoading && uiState.summary == null && uiState.error == null) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 48.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.Info,
                                    contentDescription = null,
                                    modifier = Modifier.size(48.dp),
                                    tint = GoNeutral
                                )
                                Text(
                                    "Sin datos disponibles",
                                    color = GoNeutral,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // Recent tickets
                if (uiState.recentTickets.isNotEmpty()) {
                    if (uiState.summary == null) {
                        item {
                            Text(
                                "Tickets Recientes",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                style = MaterialTheme.typography.titleMedium
                            )
                        }
                    }
                    itemsIndexed(
                        items = uiState.recentTickets,
                        key = { _, ticket -> ticket.id }
                    ) { _, ticket ->
                        RecentTicketRow(ticket = ticket)
                    }
                }
            }
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
            val date = LocalDate.parse(initialDate)
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
                val date = LocalDate.of(selectedYear, selectedMonth + 1, selectedDayOfMonth)
                onDateSelected(date.format(DateTimeFormatter.ISO_LOCAL_DATE))
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

@Composable
private fun RangeSelector(selected: DashboardRange, onSelect: (DashboardRange) -> Unit) {
    val ranges = listOf(
        DashboardRange.TODAY to "Hoy",
/*        DashboardRange.LAST7 to "Últ. 7d",*/
        DashboardRange.WEEK to "Semana",
        DashboardRange.MONTH to "Mes",
        DashboardRange.CUSTOM to "Otra Fecha",
    )
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
    ) {
        ranges.forEach { (range, label) ->
            FilterChip(
                selected = selected == range,
                onClick = { onSelect(range) },
                label = { Text(label, fontSize = 13.sp, fontWeight = FontWeight.Medium) },
                modifier = Modifier.height(40.dp),
                shape = MaterialTheme.shapes.small,
            )
        }
    }
}

@Composable
private fun KpiSection(summary: ReportSummary, finalBalance: Double?) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Row 1: Sales & Final Balance
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KpiCard(
                label = "Total Ventas",
                value = CurrencyFormatter.format(summary.totalSales),
                icon = Icons.Default.ShoppingCart,
                color = GoGold,
                modifier = Modifier.weight(1f),
            )
            val balanceColor = if (finalBalance == null || finalBalance >= 0.0) GoSuccess else GoRed
            val balanceValue = finalBalance?.let { CurrencyFormatter.format(it) } ?: "No disponible"
            KpiCard(
                label = "Balance Final",
                value = balanceValue,
                icon = Icons.Default.Wallet,
                color = balanceColor,
                modifier = Modifier.weight(1f),
            )
        }
        // Row 2: Prizes & Commissions
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KpiCard(
                label = "Premios",
                value = CurrencyFormatter.format(summary.totalPrizes),
                icon = Icons.Default.CardGiftcard,
                color = GoSuccess,
                modifier = Modifier.weight(1f),
            )
            KpiCard(
                label = "Comisiones",
                value = CurrencyFormatter.format(summary.totalCommissions),
                icon = Icons.Default.AttachMoney,
                color = GoRed,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun KpiCard(
    label: String,
    value: String,
    icon: ImageVector,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(16.dp)) {
            Icon(
                icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
            Text(text = label, fontSize = 12.sp, color = GoNeutral, style = MaterialTheme.typography.labelSmall)
            Text(
                text = value,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                style = MaterialTheme.typography.titleSmall
            )
        }
    }
}

@Composable
private fun RecentTicketRow(ticket: Ticket) {
    val purchaseDate = DateFormatter.formatDate(ticket.createdAt)
    val purchaseTime = DateFormatter.formatTime(ticket.createdAt)
    val drawName = ticket.draw?.name ?: "Sorteo"

    Card(
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                Text(
                    text = ticket.code,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    style = MaterialTheme.typography.labelLarge
                )
                if (ticket.customerName.isNotBlank()) {
                    Text(
                        text = ticket.customerName,
                        fontSize = 12.sp,
                        color = GoTextSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Text(
                    text = drawName,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = purchaseDate,
                    fontSize = 11.sp,
                    color = GoNeutral,
                    style = MaterialTheme.typography.labelSmall,
                )
            }

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = CurrencyFormatter.format(ticket.total),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    style = MaterialTheme.typography.labelLarge
                )
                Text(
                    text = purchaseTime,
                    fontSize = 12.sp,
                    color = GoNeutral,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}
