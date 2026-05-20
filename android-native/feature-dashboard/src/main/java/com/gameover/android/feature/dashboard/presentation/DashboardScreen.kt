package com.gameover.android.feature.dashboard.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material3.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val pullRefreshState = rememberPullToRefreshState()

    if (pullRefreshState.isRefreshing) {
        LaunchedEffect(Unit) {
            viewModel.refresh()
            pullRefreshState.endRefresh()
        }
    }

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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .nestedScroll(pullRefreshState.nestedScrollConnection),
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
                            GoTextField(
                                value = uiState.customFromDate,
                                onValueChange = { viewModel.onCustomDateChanged(it, uiState.customToDate) },
                                label = "Desde",
                                placeholder = "YYYY-MM-DD",
                                modifier = Modifier.weight(1f),
                            )
                            GoTextField(
                                value = uiState.customToDate,
                                onValueChange = { viewModel.onCustomDateChanged(uiState.customFromDate, it) },
                                label = "Hasta",
                                placeholder = "YYYY-MM-DD",
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                // Error banner
                if (!uiState.error.isNullOrBlank()) {
                    item { ErrorBanner(message = uiState.error) }
                }

                // Loading state
                if (uiState.isLoading) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(strokeWidth = 4.dp)
                        }
                    }
                }

                // KPI Summary
                uiState.summary?.let { summary ->
                    item {
                        AnimatedVisibility(
                            visible = !uiState.isLoading,
                            enter = fadeIn(),
                            exit = fadeOut()
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                KpiSection(summary = summary)
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
                    itemsIndexed(uiState.recentTickets) { _, ticket ->
                        RecentTicketRow(ticket = ticket)
                    }
                }
            }

            PullToRefreshContainer(
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        }
    }
}

@Composable
private fun RangeSelector(selected: DashboardRange, onSelect: (DashboardRange) -> Unit) {
    val ranges = listOf(
        DashboardRange.TODAY to "Hoy",
        DashboardRange.LAST7 to "Últ. 7d",
        DashboardRange.WEEK to "Semana",
        DashboardRange.MONTH to "Mes",
        DashboardRange.CUSTOM to "Custom",
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
private fun KpiSection(summary: ReportSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Row 1: Sales & Tickets
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
            KpiCard(
                label = "Tickets",
                value = summary.ticketCount.toString(),
                icon = Icons.AutoMirrored.Filled.List,
                color = GoBlue,
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
    val purchaseDate = ticket.createdAt.take(10)
    val purchaseTime = ticket.createdAt.substringAfter('T', "").take(5).ifBlank { "--:--" }
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
