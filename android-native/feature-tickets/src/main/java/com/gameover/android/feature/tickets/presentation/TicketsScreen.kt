package com.gameover.android.feature.tickets.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.GoNeutral

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketsScreen(
    onTicketClick: (String) -> Unit,
    onScanClick: () -> Unit,
    viewModel: TicketsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val pullRefreshState = rememberPullToRefreshState()

    if (pullRefreshState.isRefreshing) {
        LaunchedEffect(Unit) {
            viewModel.loadData()
            pullRefreshState.endRefresh()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tickets") },
                actions = {
                    IconButton(onClick = viewModel::loadData) {
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
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item { NoConnectionBanner(isVisible = !uiState.isOnline) }

                // Search bar
                item {
                    OutlinedTextField(
                        value = uiState.searchQuery,
                        onValueChange = viewModel::onSearchQueryChanged,
                        label = { Text("Buscar por código o cliente") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            IconButton(onClick = onScanClick) {
                                Icon(Icons.Default.QrCodeScanner, contentDescription = "Escanear código")
                            }
                        },
                        singleLine = true,
                    )
                }

                // Filters
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        FilterChip(
                            selected = uiState.includeCanceled,
                            onClick = { viewModel.onIncludeCanceledChanged(!uiState.includeCanceled) },
                            label = { Text("Incluir anulados", fontSize = 12.sp) },
                        )
                    }
                }

                item { ErrorBanner(message = uiState.error) }

                if (uiState.isLoading) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                }

                if (!uiState.isLoading && uiState.filteredTickets.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                            Text("No hay tickets que mostrar", color = GoNeutral)
                        }
                    }
                }

                items(uiState.filteredTickets, key = { it.id }) { ticket ->
                    TicketListItem(ticket = ticket, onClick = { onTicketClick(ticket.id) })
                }
            }

            PullToRefreshContainer(state = pullRefreshState, modifier = Modifier.align(Alignment.TopCenter))
        }
    }
}

@Composable
private fun TicketListItem(ticket: Ticket, onClick: () -> Unit) {
    GoCard(modifier = Modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = ticket.code, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                if (ticket.customerName.isNotBlank()) {
                    Text(text = ticket.customerName, fontSize = 12.sp, color = GoNeutral)
                }
                ticket.draw?.let {
                    Text(text = it.name, fontSize = 11.sp, color = GoNeutral)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = CurrencyFormatter.format(ticket.total),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
                Spacer(modifier = Modifier.height(4.dp))
                PaymentStatusBadge(
                    status = ticket.paymentStatus.name,
                    isCanceled = ticket.canceledAt != null,
                )
            }
        }
    }
}
