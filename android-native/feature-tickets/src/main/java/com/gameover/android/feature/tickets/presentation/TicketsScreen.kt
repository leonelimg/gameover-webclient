package com.gameover.android.feature.tickets.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import com.gameover.android.core.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketsScreen(
    onTicketClick: (String) -> Unit,
    onScanClick: () -> Unit,
    viewModel: TicketsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Tickets",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    IconButton(onClick = viewModel::loadData) {
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
            onRefresh = viewModel::loadData,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { NoConnectionBanner(isVisible = !uiState.isOnline) }

                // Search bar with QR scan
                item {
                    GoTextField(
                        value = uiState.searchQuery,
                        onValueChange = viewModel::onSearchQueryChanged,
                        label = "Buscar tickets",
                        placeholder = "Código o cliente...",
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(20.dp))
                        },
                        trailingIcon = {
                            IconButton(
                                onClick = onScanClick,
                                modifier = Modifier.size(40.dp)
                            ) {
                                Icon(
                                    Icons.Default.QrCodeScanner,
                                    contentDescription = "Escanear código",
                                    tint = GoRed,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        },
                    )
                }

                // Filters with better styling
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
                            shape = MaterialTheme.shapes.small,
                        )
                    }
                }

                item { ErrorBanner(message = uiState.error) }

                if (uiState.isLoading) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(150.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(strokeWidth = 4.dp)
                        }
                    }
                }

                if (!uiState.isLoading && uiState.filteredTickets.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 48.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.ConfirmationNumber,
                                    contentDescription = null,
                                    modifier = Modifier.size(48.dp),
                                    tint = GoNeutral
                                )
                                Text(
                                    "No hay tickets que mostrar",
                                    color = GoNeutral,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                items(uiState.filteredTickets, key = { it.id }) { ticket ->
                    AnimatedVisibility(
                        visible = true,
                        enter = fadeIn(),
                        exit = fadeOut()
                    ) {
                        TicketListItem(ticket = ticket, onClick = { onTicketClick(ticket.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun TicketListItem(ticket: Ticket, onClick: () -> Unit) {
    GoCard(
        modifier = Modifier,
        elevation = 2f,
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = ticket.code,
                    fontWeight = FontWeight.Bold,
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
                ticket.draw?.let {
                    Text(
                        text = it.name,
                        fontSize = 11.sp,
                        color = GoNeutral,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = CurrencyFormatter.format(ticket.total),
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 14.sp,
                    style = MaterialTheme.typography.labelLarge
                )
                PaymentStatusBadge(
                    status = ticket.paymentStatus.name,
                    isCanceled = ticket.canceledAt != null,
                )
            }
        }
    }
}
