package com.gameover.android.feature.sales.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
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

import androidx.compose.ui.platform.LocalContext
import com.gameover.android.feature.bluetooth.escpos.TicketImageGenerator
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    viewModel: SalesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val textFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = Color(0xFF673AB7),
        unfocusedBorderColor = if (isSystemInDarkTheme()) Color(0xFFCCCCCC) else Color(0xFF1E1E1E),
        focusedLabelColor = Color(0xFF673AB7),
        unfocusedLabelColor = if (isSystemInDarkTheme()) Color(0xFFAAAAAA) else Color(0xFF555555),
    )
    val snackbarHostState = remember { SnackbarHostState() }
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    // Auto-scroll to bottom when a new line is added
    LaunchedEffect(uiState.lines.size) {
        if (uiState.lines.isNotEmpty()) {
            listState.animateScrollToItem(uiState.lines.size + 5) // Scroll past lines to ensure visibility
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
                    if (uiState.selectedDrawId.isNotEmpty()) {
                        Surface(
                            color = GoSuccessDark,
                            shape = MaterialTheme.shapes.small,
                            modifier = Modifier.padding(end = 4.dp)
                        ) {
                            Text(
                                text = CurrencyFormatter.format(uiState.drawTotalSales),
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                    IconButton(onClick = viewModel::showSearchDialog) {
                        Icon(Icons.Default.Search, contentDescription = "Buscar ticket")
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
        bottomBar = {
            // Persistent bottom bar for Total and Submit button (only if not showing success)
            if (!(uiState.lastTicket != null && uiState.saleResult is SaleResult.Success)) {
                Surface(
                    tonalElevation = 8.dp,
                    shadowElevation = 8.dp,
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.extraLarge.copy(
                        bottomStart = androidx.compose.foundation.shape.CornerSize(0.dp),
                        bottomEnd = androidx.compose.foundation.shape.CornerSize(0.dp)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .imePadding()
                            .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(0.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text(
                                    "TOTAL A PAGAR",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = GoSuccessDark,
                                    style = MaterialTheme.typography.labelSmall
                                )
                                Text(
                                    CurrencyFormatter.format(uiState.total),
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 28.sp,
                                    color = GoSuccessDark,
                                )
                            }
                            Button(
                                onClick = viewModel::sell,
                                enabled = uiState.selectedDrawId.isNotEmpty() && uiState.saleResult !is SaleResult.Loading,
                                modifier = Modifier
                                    .height(56.dp)
                                    .padding(start = 16.dp),
                                shape = MaterialTheme.shapes.large,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = GoSuccessDark,
                                    contentColor = Color.White
                                )
                            ) {
                                if (uiState.saleResult is SaleResult.Loading) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                                } else {
                                    Icon(Icons.Default.ShoppingCart, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("VENDER", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                            }
                        }
                    }
                }
            }
        },
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize()) {
            PullToRefreshBox(
                isRefreshing = uiState.isLoadingDraws,
                onRefresh = viewModel::loadDraws,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    item { NoConnectionBanner(isVisible = !uiState.isOnline) }

                    // After successful sale: show confirmation card and stop rendering the form
                    if (uiState.lastTicket != null && uiState.saleResult is SaleResult.Success) {
                        item {
                            TicketSuccessCard(
                                ticket = uiState.lastTicket!!,
                                isPrinting = uiState.isPrintingTicket,
                                isCanceling = uiState.isCanceling,
                                onPrint = viewModel::printLastTicket,
                                onShareWhatsapp = {
                                    scope.launch {
                                        val lines = viewModel.getTicketLinesForSharing()
                                        if (lines != null) {
                                            TicketImageGenerator.shareTicketAsImage(context, lines)
                                        }
                                    }
                                },
                                onCancel = viewModel::showCancelDialog,
                                onNewSale = { viewModel.clearLastTicket() },
                            )
                        }
                        return@LazyColumn
                    }

                    // Draw selector & Customer name
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            DrawSelector(
                                openDraws = uiState.openDraws,
                                selectedDrawId = uiState.selectedDrawId,
                                onDrawSelected = viewModel::onDrawSelected,
                                isLoading = uiState.isLoadingDraws,
                                modifier = Modifier.weight(1f),
                                colors = textFieldColors,
                            )
                            GoTextField(
                                value = uiState.customerName,
                                onValueChange = viewModel::onCustomerNameChanged,
                                label = "Cliente",
                                placeholder = "Juan Pérez",
                                modifier = Modifier.weight(1f),
                                colors = textFieldColors,
                            )
                        }
                    }

                    // Active DrawType indicator
                    uiState.selectedDraw?.drawType?.let { dt ->
                        item {
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                                shape = MaterialTheme.shapes.medium,
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Info,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = "Tipo: ${dt.name} (${dt.digits} Dígitos)",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        )
                                    }
                                    Text(
                                        text = "Multiplicador: ${dt.multiplier}x",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary,
                                    )
                                }
                            }
                        }
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

                    // Restricted numbers section (replacing "Numeros" label and "Agregar" button)
                    if (uiState.restrictedNumbers.isNotEmpty()) {
                        item {
                            OutlinedCard(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                border = CardDefaults.outlinedCardBorder(enabled = true).copy(
                                    brush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.error.copy(alpha = 0.4f))
                                )
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Warning,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.error,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = "RESTRINGIDOS",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.error
                                        )
                                    }
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .horizontalScroll(rememberScrollState()),
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        uiState.restrictedNumbers.forEach { number ->
                                            Surface(
                                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f),
                                                shape = MaterialTheme.shapes.small
                                            ) {
                                                Text(
                                                    text = number,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    color = MaterialTheme.colorScheme.error,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Bet lines
                    itemsIndexed(uiState.lines, key = { _, line -> line.id }) { index, line ->
                        val numberFocusRequester = remember { FocusRequester() }

                        // Auto-focus the new line when added
                        LaunchedEffect(Unit) {
                            if (line.number.isEmpty() && index > 0) {
                                numberFocusRequester.requestFocus()
                            }
                        }

                        val targetDigits = uiState.targetDigits
                        BetLineRow(
                            line = line,
                            showSpecial = uiState.hasSpecialMultiplier,
                            canDelete = uiState.lines.size > 1,
                            targetDigits = targetDigits,
                            onNumberChange = { input ->
                                val digitsOnly = input.filter { it.isDigit() }
                                if (digitsOnly.length <= targetDigits) {
                                    viewModel.onLineNumberChanged(line.id, digitsOnly)
                                    if (digitsOnly.length == targetDigits) {
                                        focusManager.moveFocus(FocusDirection.Next)
                                    }
                                }
                            },
                            onAmountChange = { viewModel.onLineAmountChanged(line.id, it) },
                            onSpecialAmountChange = { viewModel.onLineSpecialAmountChanged(line.id, it) },
                            onDelete = { viewModel.removeLine(line.id) },
                            numberFocusRequester = numberFocusRequester,
                            isLastLine = index == uiState.lines.lastIndex,
                            onNextLine = { viewModel.addLine() },
                            colors = textFieldColors,
                        )
                    }
                }
            }

            if (uiState.cancelDialog) {
                AlertDialog(
                    onDismissRequest = viewModel::hideCancelDialog,
                    title = { Text("Anular Ticket") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("¿Estás seguro de que deseas anular este ticket?")
                            GoTextField(
                                value = uiState.cancelReason,
                                onValueChange = viewModel::onCancelReasonChanged,
                                label = "Motivo (opcional, max 300)",
                                singleLine = false,
                            )
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = viewModel::cancelLastTicket) {
                            Text("Anular", color = MaterialTheme.colorScheme.error)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = viewModel::hideCancelDialog) { Text("Cancelar") }
                    },
                )
            }

            if (uiState.searchDialog) {
                AlertDialog(
                    onDismissRequest = viewModel::hideSearchDialog,
                    title = { Text("Buscar Ticket") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Ingresa el código del ticket para cargar sus números.")
                            GoTextField(
                                value = uiState.searchTicketCode,
                                onValueChange = viewModel::onSearchTicketCodeChanged,
                                label = "Código del ticket",
                                placeholder = "TK-XXXXXX",
                                singleLine = true,
                                isError = uiState.searchError != null,
                                errorMessage = uiState.searchError
                            )
                        }
                    },
                    confirmButton = {
                        TextButton(
                            onClick = viewModel::searchAndLoadTicket,
                            enabled = !uiState.isSearchingTicket && uiState.searchTicketCode.isNotBlank()
                        ) {
                            if (uiState.isSearchingTicket) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                            } else {
                                Text("Cargar")
                            }
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = viewModel::hideSearchDialog) { Text("Cancelar") }
                    },
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
    modifier: Modifier = Modifier,
    colors: TextFieldColors = OutlinedTextFieldDefaults.colors(),
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDraw = openDraws.find { it.id == selectedDrawId }

    val drawLabel = selectedDraw?.let { draw ->
        draw.drawType?.let { dt -> "${draw.name} (${dt.digits}D)" } ?: draw.name
    } ?: if (isLoading) "Cargando..." else "Selecciona un sorteo..."

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = drawLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text("Sorteo") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = colors,
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            if (openDraws.isEmpty()) {
                DropdownMenuItem(
                    text = { Text("No hay sorteos abiertos", color = GoNeutral) },
                    onClick = { expanded = false },
                )
            }
            openDraws.forEach { draw ->
                val itemLabel = draw.drawType?.let { dt -> "${draw.name} (${dt.digits}D)" } ?: draw.name
                DropdownMenuItem(
                    text = { Text(itemLabel) },
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
    targetDigits: Int = 2,
    onNumberChange: (String) -> Unit,
    onAmountChange: (String) -> Unit,
    onSpecialAmountChange: (String) -> Unit,
    onDelete: () -> Unit,
    numberFocusRequester: FocusRequester,
    isLastLine: Boolean,
    onNextLine: () -> Unit,
    colors: TextFieldColors = OutlinedTextFieldDefaults.colors(),
) {
    val focusManager = LocalFocusManager.current

    var amountValue by remember { mutableStateOf(TextFieldValue(line.amount)) }
    var specialAmountValue by remember { mutableStateOf(TextFieldValue(line.specialAmount)) }

    // Sync local TextFieldValue with external state from ViewModel
    if (amountValue.text != line.amount) {
        amountValue = amountValue.copy(text = line.amount)
    }
    if (specialAmountValue.text != line.specialAmount) {
        specialAmountValue = specialAmountValue.copy(text = line.specialAmount)
    }

    val numFieldWidth = if (targetDigits >= 4) 108.dp else if (targetDigits == 3) 98.dp else 92.dp

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
            OutlinedTextField(
                value = line.number,
                onValueChange = onNumberChange,
                label = { Text("Núm.") },
                placeholder = { Text("0".repeat(targetDigits)) },
                modifier = Modifier
                    .width(numFieldWidth)
                    .focusRequester(numberFocusRequester)
                    .onKeyEvent { event ->
                        if ((event.key == Key.Tab || event.key == Key.Enter || event.key == Key.NumPadEnter) && event.type == KeyEventType.KeyDown) {
                            focusManager.moveFocus(FocusDirection.Next)
                            true
                        } else false
                    },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Next) }
                ),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
                colors = colors,
            )
            OutlinedTextField(
                value = amountValue,
                onValueChange = {
                    amountValue = it
                    onAmountChange(it.text)
                },
                label = { Text("Monto") },
                modifier = Modifier
                    .weight(1f)
                    .onFocusChanged {
                        if (it.isFocused) {
                            amountValue = amountValue.copy(
                                selection = TextRange(0, amountValue.text.length)
                            )
                        }
                    }
                    .onKeyEvent { event ->
                        if ((event.key == Key.Tab || event.key == Key.Enter || event.key == Key.NumPadEnter) && event.type == KeyEventType.KeyDown) {
                            if (isLastLine && !showSpecial) {
                                onNextLine()
                                true
                            } else {
                                focusManager.moveFocus(FocusDirection.Next)
                                true
                            }
                        } else false
                    },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Decimal,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = {
                        if (showSpecial) {
                            focusManager.moveFocus(FocusDirection.Next)
                        } else {
                            if (isLastLine) onNextLine()
                            else focusManager.moveFocus(FocusDirection.Next)
                        }
                    }
                ),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
                colors = colors,
            )
            if (showSpecial) {
                OutlinedTextField(
                    value = specialAmountValue,
                    onValueChange = {
                        specialAmountValue = it
                        onSpecialAmountChange(it.text)
                    },
                    label = { Text("Espec.") },
                    modifier = Modifier
                        .weight(1f)
                        .onFocusChanged {
                            if (it.isFocused) {
                                specialAmountValue = specialAmountValue.copy(
                                    selection = TextRange(0, specialAmountValue.text.length)
                                )
                            }
                        }
                        .onKeyEvent { event ->
                            if ((event.key == Key.Tab || event.key == Key.Enter || event.key == Key.NumPadEnter) && event.type == KeyEventType.KeyDown) {
                                if (isLastLine) {
                                    onNextLine()
                                    true
                                } else {
                                    focusManager.moveFocus(FocusDirection.Next)
                                    true
                                }
                            } else false
                        },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Decimal,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = {
                            if (isLastLine) onNextLine()
                            else focusManager.moveFocus(FocusDirection.Next)
                        }
                    ),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall,
                    colors = colors,
                )
            }
            FilledIconButton(
                onClick = onDelete,
                enabled = canDelete,
                modifier = Modifier.size(36.dp),
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = GoDanger.copy(alpha = 0.1f),
                    contentColor = GoDanger,
                    disabledContainerColor = GoNeutral.copy(alpha = 0.05f),
                    disabledContentColor = GoNeutral
                )
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Eliminar línea",
                    modifier = Modifier.size(20.dp)
                )
            }
    }
}

@Composable
private fun TicketSuccessCard(
    ticket: Ticket,
    isPrinting: Boolean,
    isCanceling: Boolean,
    onPrint: () -> Unit,
    onShareWhatsapp: () -> Unit,
    onCancel: () -> Unit,
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
                color = GoSuccessDark,
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
                    color = GoSuccessDark,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Action buttons
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GoButton(
                        text = "Imprimir",
                        onClick = onPrint,
                        loading = isPrinting,
                        modifier = Modifier.weight(1f),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = GoBlue,
                        contentColor = Color.White,
                        trailingIcon = Icons.Default.Bluetooth,
                    )
                    GoButton(
                        text = "WhatsApp",
                        onClick = onShareWhatsapp,
                        modifier = Modifier.weight(1f),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = GoSuccessDark,
                        contentColor = Color.White,
                        trailingIcon = Icons.Default.Share,
                    )
                }
                
                if (ticket.canceledAt == null) {
                    GoButton(
                        text = "Anular Ticket",
                        onClick = onCancel,
                        loading = isCanceling,
                        modifier = Modifier.fillMaxWidth(),
                        variant = ButtonVariant.PRIMARY,
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = Color.White,
                    )
                }

                GoButton(
                    text = "Nueva Venta",
                    onClick = onNewSale,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
