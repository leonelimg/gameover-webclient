package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.GoNeutral

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
                title = { Text("Dashboard") },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                },
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
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // No connection banner
                item {
                    NoConnectionBanner(isVisible = !uiState.isOnline, onRetry = { viewModel.refresh() })
                }

                // Range selector
                item {
                    RangeSelector(
                        selected = uiState.selectedRange,
                        onSelect = viewModel::onRangeSelected,
                    )
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
                                label = "Desde (YYYY-MM-DD)",
                                modifier = Modifier.weight(1f),
                            )
                            GoTextField(
                                value = uiState.customToDate,
                                onValueChange = { viewModel.onCustomDateChanged(uiState.customFromDate, it) },
                                label = "Hasta (YYYY-MM-DD)",
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }

                // Error banner
                item { ErrorBanner(message = uiState.error) }

                // Loading
                if (uiState.isLoading) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }

                // KPI cards
                uiState.summary?.let { summary ->
                    item { KpiSection(summary = summary) }
                }

                // Empty state
                if (!uiState.isLoading && uiState.summary == null && uiState.error == null) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("Sin datos", color = GoNeutral)
                        }
                    }
                }

                // Recent tickets
                if (uiState.recentTickets.isNotEmpty()) {
                    item {
                        Text("Tickets Recientes", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                    items(uiState.recentTickets) { ticket ->
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
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        ranges.forEach { (range, label) ->
            FilterChip(
                selected = selected == range,
                onClick = { onSelect(range) },
                label = { Text(label, fontSize = 12.sp) },
            )
        }
    }
}

@Composable
private fun KpiSection(summary: ReportSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            KpiCard(
                label = "Total Ventas",
                value = CurrencyFormatter.format(summary.totalSales),
                modifier = Modifier.weight(1f),
            )
            KpiCard(
                label = "Tickets",
                value = summary.ticketCount.toString(),
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            KpiCard(
                label = "Premios",
                value = CurrencyFormatter.format(summary.totalPrizes),
                modifier = Modifier.weight(1f),
            )
            KpiCard(
                label = "Comisiones",
                value = CurrencyFormatter.format(summary.totalCommissions),
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun KpiCard(label: String, value: String, modifier: Modifier = Modifier) {
    GoCard(modifier = modifier) {
        Text(text = label, fontSize = 12.sp, color = GoNeutral)
        Spacer(modifier = Modifier.height(4.dp))
        Text(text = value, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun RecentTicketRow(ticket: Ticket) {
    GoCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(text = ticket.code, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                if (ticket.customerName.isNotBlank()) {
                    Text(text = ticket.customerName, fontSize = 12.sp, color = GoNeutral)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = CurrencyFormatter.format(ticket.total),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
                PaymentStatusBadge(status = ticket.paymentStatus.name, isCanceled = ticket.canceledAt != null)
            }
        }
    }
}
