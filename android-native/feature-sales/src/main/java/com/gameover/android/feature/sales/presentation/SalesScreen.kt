package com.gameover.android.feature.sales.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.ui.component.GoButton
import com.gameover.android.core.ui.component.GoCard
import com.gameover.android.core.ui.component.GoTextField
import com.gameover.android.core.ui.component.NoConnectionBanner
import com.gameover.android.core.ui.component.ButtonVariant
import com.gameover.android.core.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    viewModel: SalesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val pullRefreshState = rememberPullToRefreshState()

    if (pullRefreshState.isRefreshing) {
        LaunchedEffect(Unit) {
            viewModel.loadDraws()
            pullRefreshState.endRefresh()
        }
    }

    LaunchedEffect(uiState.saleResult) {
        when (val result = uiState.saleResult) {
            is SaleResult.Error -> {
                snackbarHostState.showSnackbar(result.message, duration = SnackbarDuration.Long)
                viewModel.clearError()
            }
            is SaleResult.Offline -> {
                snackbarHostState.showSnackbar(result.message)
            }
            else -> {}
        }
    }

    LaunchedEffect(uiState.printStatusMessage) {
        uiState.printStatusMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearPrintStatus()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Ventas",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    if (uiState.pendingCount > 0) {
                        Badge(
                            modifier = Modifier
                                .align(Alignment.CenterVertically)
                                .padding(end = 16.dp)
                        ) {
                            Text(uiState.pendingCount.toString(), style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    IconButton(onClick = viewModel::loadDraws) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar sorteos")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item { NoConnectionBanner(isVisible = !uiState.isOnline) }

                // After successful sale: show confirmation card and stop rendering the form
                if (uiState.lastTicket != null && uiState.saleResult is SaleResult.Success) {
                    item {
                        TicketSuccessCard(
                            ticket = uiState.lastTicket!!,
                            isPrinting = uiState.isPrintingTicket,
                            onPrint = viewModel::printLastTicket,
                            onNewSale = { viewModel.clearLastTicket() },
                        )
                    }
                    return@LazyColumn
                }

                // Draw selector
                item {
                    DrawSelector(
                        openDraws = uiState.openDraws,
                        selectedDrawId = uiState.selectedDrawId,
                        onDrawSelected = viewModel::onDrawSelected,
                        isLoading = uiState.isLoadingDraws,
                    )
                }

                // Customer name (optional)
                item {
                    GoTextField(
                        value = uiState.customerName,
                        onValueChange = viewModel::onCustomerNameChanged,
                        label = "Nombre del cliente",
                        placeholder = "Juan Pérez (opcional)",
                    )
                }

                // Active special multiplier indicator
                uiState.selectedDraw?.specialMultiplier?.let { sm ->
                    item {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = GoGold.copy(alpha = 0.15f),
                            shape = MaterialTheme.shapes.medium,
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = GoGold,
                                    modifier = Modifier.size(20.dp)
                                )
                                Text(
                                    text = "Multiplicador activo: ${sm.name} (×${sm.value})",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = GoGold,
                                )
                            }
                        }
                    }
                }

                // Bet lines header
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Números",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            style = MaterialTheme.typography.titleMedium
                        )
                        TextButton(onClick = viewModel::addLine) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Agregar", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                // Bet lines
                itemsIndexed(uiState.lines, key = { _, line -> line.id }) { _, line ->
                    BetLineRow(
                        line = line,
                        showSpecial = uiState.hasSpecialMultiplier,
                        canDelete = uiState.lines.size > 1,
                        onNumberChange = { viewModel.onLineNumberChanged(line.id, it) },
                        onAmountChange = { viewModel.onLineAmountChanged(line.id, it) },
                        onSpecialAmountChange = { viewModel.onLineSpecialAmountChanged(line.id, it) },
                        onDelete = { viewModel.removeLine(line.id) },
                    )
                }

                // Running total summary
                item {
                    GoCard(elevation = 4f) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Total:",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                style = MaterialTheme.typography.titleSmall
                            )
                            Text(
                                CurrencyFormatter.format(uiState.total),
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 20.sp,
                                color = GoRed,
                            )
                        }
                    }
                }

                // Submit button
                item {
                    GoButton(
                        text = "Registrar Venta",
                        onClick = viewModel::sell,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = uiState.selectedDrawId.isNotEmpty(),
                        loading = uiState.saleResult is SaleResult.Loading,
                    )
                }
            }

            PullToRefreshContainer(
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DrawSelector(
    openDraws: List<Draw>,
    selectedDrawId: String,
    onDrawSelected: (String) -> Unit,
    isLoading: Boolean,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDraw = openDraws.find { it.id == selectedDrawId }

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedDraw?.name ?: if (isLoading) "Cargando..." else "Selecciona un sorteo...",
            onValueChange = {},
            readOnly = true,
            label = { Text("Sorteo") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            if (openDraws.isEmpty()) {
                DropdownMenuItem(
                    text = { Text("No hay sorteos abiertos", color = GoNeutral) },
                    onClick = { expanded = false },
                )
            }
            openDraws.forEach { draw ->
                DropdownMenuItem(
                    text = { Text(draw.name) },
                    onClick = {
                        onDrawSelected(draw.id)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun BetLineRow(
    line: SaleLine,
    showSpecial: Boolean,
    canDelete: Boolean,
    onNumberChange: (String) -> Unit,
    onAmountChange: (String) -> Unit,
    onSpecialAmountChange: (String) -> Unit,
    onDelete: () -> Unit,
) {
    GoCard(elevation = 2f) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = line.number,
                onValueChange = { if (it.length <= 2) onNumberChange(it) },
                label = { Text("Núm.") },
                modifier = Modifier
                    .width(96.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
            )
            OutlinedTextField(
                value = line.amount,
                onValueChange = onAmountChange,
                label = { Text("Monto") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
            )
            if (showSpecial) {
                OutlinedTextField(
                    value = line.specialAmount,
                    onValueChange = onSpecialAmountChange,
                    label = { Text("Espec.") },
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall,
                )
            }
            IconButton(onClick = onDelete, enabled = canDelete) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Eliminar línea",
                    tint = if (canDelete) GoDanger else GoNeutral,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
private fun TicketSuccessCard(
    ticket: Ticket,
    isPrinting: Boolean,
    onPrint: () -> Unit,
    onNewSale: () -> Unit,
) {
    GoCard(elevation = 6f) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            // Success icon and message
            Surface(
                modifier = Modifier.size(60.dp),
                color = GoSuccess.copy(alpha = 0.15f),
                shape = MaterialTheme.shapes.extraLarge
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = GoSuccess,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            Text(
                "¡Venta Registrada!",
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
                color = GoSuccess,
                style = MaterialTheme.typography.titleMedium
            )
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    "Código: ${ticket.code}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    style = MaterialTheme.typography.labelLarge
                )
                Text(
                    "Total: ${CurrencyFormatter.format(ticket.total)}",
                    fontSize = 14.sp,
                    color = GoTextSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Action buttons
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                GoButton(
                    text = "Imprimir Ticket",
                    onClick = onPrint,
                    loading = isPrinting,
                    modifier = Modifier.fillMaxWidth(),
                    variant = ButtonVariant.OUTLINED,
                )
                GoButton(
                    text = "Nueva Venta",
                    onClick = onNewSale,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
