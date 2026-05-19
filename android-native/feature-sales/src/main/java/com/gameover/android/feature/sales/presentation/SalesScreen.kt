package com.gameover.android.feature.sales.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.gameover.android.core.ui.theme.GoNeutral
import com.gameover.android.core.ui.theme.GoSuccess

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    viewModel: SalesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("Ventas")
                        if (uiState.pendingCount > 0) {
                            Badge { Text(uiState.pendingCount.toString()) }
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { NoConnectionBanner(isVisible = !uiState.isOnline) }

            // After successful sale: show confirmation card and stop rendering the form
            if (uiState.lastTicket != null && uiState.saleResult is SaleResult.Success) {
                item {
                    TicketSuccessCard(
                        ticket = uiState.lastTicket!!,
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
                    label = "Nombre del cliente (opcional)",
                    placeholder = "Ej: Juan Pérez",
                )
            }

            // Active special multiplier indicator
            uiState.selectedDraw?.specialMultiplier?.let { sm ->
                item {
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        shape = MaterialTheme.shapes.small,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = "Multiplicador especial activo: ${sm.name} (×${sm.value})",
                            modifier = Modifier.padding(12.dp),
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                        )
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
                    Text("Apuestas", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    TextButton(onClick = viewModel::addLine) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Agregar línea")
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

            // Running total
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    Text("Total: ", fontWeight = FontWeight.Medium, fontSize = 16.sp)
                    Text(
                        CurrencyFormatter.format(uiState.total),
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            // Submit — always enabled when a draw is selected (offline sales queue if no connection)
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
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = line.number,
            onValueChange = { if (it.length <= 2) onNumberChange(it) },
            label = { Text("Núm.") },
            modifier = Modifier.width(72.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
        )
        OutlinedTextField(
            value = line.amount,
            onValueChange = onAmountChange,
            label = { Text("Monto") },
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            singleLine = true,
        )
        if (showSpecial) {
            OutlinedTextField(
                value = line.specialAmount,
                onValueChange = onSpecialAmountChange,
                label = { Text("Especial") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
            )
        }
        IconButton(onClick = onDelete, enabled = canDelete) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Eliminar línea",
                tint = if (canDelete) MaterialTheme.colorScheme.error else GoNeutral,
            )
        }
    }
}

@Composable
private fun TicketSuccessCard(ticket: Ticket, onNewSale: () -> Unit) {
    GoCard {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("¡Venta Registrada!", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = GoSuccess)
            Text("Código: ${ticket.code}", fontWeight = FontWeight.Medium, fontSize = 16.sp)
            Text("Total: ${CurrencyFormatter.format(ticket.total)}", fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
            GoButton(text = "Nueva Venta", onClick = onNewSale, modifier = Modifier.fillMaxWidth())
        }
    }
}
