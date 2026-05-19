package com.gameover.android.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.gameover.android.app.navigation.AppDestination
import com.gameover.android.app.presentation.AppViewModel
import com.gameover.android.core.common.ResultState
import com.gameover.android.feature.dashboard.DashboardDateRange
import com.gameover.android.feature.dashboard.presentation.DashboardViewModel
import com.gameover.android.feature.reports.presentation.CommissionReportViewModel
import com.gameover.android.feature.reports.presentation.WinningTicketsReportViewModel
import com.gameover.android.feature.sales.domain.SalesInputRules
import com.gameover.android.feature.sales.presentation.SalesViewModel
import com.gameover.android.feature.tickets.presentation.TicketsViewModel
import kotlinx.coroutines.launch

@Composable
fun GameOverAppRoot(
    appViewModel: AppViewModel = hiltViewModel()
) {
    val navController = rememberNavController()
    val appState by appViewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(appState.isAuthenticated, appState.loading) {
        if (!appState.loading) {
            if (appState.isAuthenticated) {
                navController.navigate(AppDestination.Dashboard.route) {
                    popUpTo(AppDestination.Login.route) { inclusive = true }
                }
            } else {
                navController.navigate(AppDestination.Login.route) {
                    popUpTo(0)
                }
            }
        }
    }

    appState.message?.let { msg ->
        LaunchedEffect(msg) { snackbarHostState.showSnackbar(msg) }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        if (appState.loading) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(12.dp))
                Text("Restaurando sesión...")
            }
            return@Scaffold
        }

        NavHost(
            navController = navController,
            startDestination = if (appState.isAuthenticated) AppDestination.Dashboard.route else AppDestination.Login.route,
            modifier = Modifier.padding(padding)
        ) {
            composable(AppDestination.Login.route) {
                LoginScreen(
                    onLogin = appViewModel::login
                )
            }
            composable(AppDestination.Dashboard.route) {
                MainShell(navController = navController, onLogout = appViewModel::logout, appViewModel = appViewModel) {
                    DashboardRoute()
                }
            }
            composable(AppDestination.Sales.route) {
                MainShell(navController = navController, onLogout = appViewModel::logout, appViewModel = appViewModel) {
                    SalesRoute()
                }
            }
            composable(AppDestination.Tickets.route) {
                MainShell(navController = navController, onLogout = appViewModel::logout, appViewModel = appViewModel) {
                    TicketsRoute()
                }
            }
            composable(AppDestination.WinnersReport.route) {
                MainShell(navController = navController, onLogout = appViewModel::logout, appViewModel = appViewModel) {
                    WinnersReportRoute()
                }
            }
            composable(AppDestination.CommissionsReport.route) {
                MainShell(navController = navController, onLogout = appViewModel::logout, appViewModel = appViewModel) {
                    CommissionsRoute()
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(
    onLogin: (String, String) -> Unit
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("GameOver Android", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Usuario") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Contraseña") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = { onLogin(username.trim(), password) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Iniciar sesión")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainShell(
    navController: NavHostController,
    onLogout: () -> Unit,
    appViewModel: AppViewModel,
    content: @Composable () -> Unit
) {
    val currentBackStack by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStack?.destination?.route
    val appState by appViewModel.uiState.collectAsStateWithLifecycle()
    val destinations = listOf(
        AppDestination.Dashboard,
        AppDestination.Sales,
        AppDestination.Tickets,
        AppDestination.WinnersReport,
        AppDestination.CommissionsReport
    ).filter { appState.canAccess(it) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("GameOver Android") },
                actions = {
                    Button(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null)
                        Spacer(modifier = Modifier.padding(2.dp))
                        Text("Salir")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                destinations.forEach { destination ->
                    NavigationBarItem(
                        selected = currentRoute == destination.route,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(AppDestination.Dashboard.route)
                                launchSingleTop = true
                            }
                        },
                        icon = {
                            when (destination) {
                                AppDestination.Dashboard -> Icon(Icons.Default.Dashboard, null)
                                AppDestination.Sales -> Icon(Icons.Default.Sell, null)
                                AppDestination.Tickets -> Icon(Icons.Default.ConfirmationNumber, null)
                                AppDestination.WinnersReport,
                                AppDestination.CommissionsReport -> Icon(Icons.Default.CreditCard, null)
                                else -> Icon(Icons.Default.Dashboard, null)
                            }
                        },
                        label = { Text(destination.route) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            content()
        }
    }
}

@Composable
private fun DashboardRoute(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load(DashboardDateRange.TODAY) }

    when (val value = state) {
        is ResultState.Loading -> CenterLoading("Cargando dashboard...")
        is ResultState.Error -> ErrorText(value.error.toString())
        is ResultState.Success -> {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Dashboard", style = MaterialTheme.typography.titleLarge)
                val summary = value.data.summary
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Tickets: ${summary?.ticketCount ?: 0}")
                        Text("Ventas: ${summary?.totalSales ?: 0.0}")
                        Text("Premios: ${summary?.totalPrizes ?: 0.0}")
                        Text("Comisiones: ${summary?.totalCommissions ?: 0.0}")
                    }
                }
                if (value.data.staleData) {
                    Text("Mostrando datos en caché", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun SalesRoute(viewModel: SalesViewModel = hiltViewModel()) {
    var drawId by remember { mutableStateOf("") }
    var customerName by remember { mutableStateOf("") }
    var number by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var special by remember { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val queueStatus by viewModel.queueStatus.collectAsStateWithLifecycle()

    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Ventas", style = MaterialTheme.typography.titleLarge)
        OutlinedTextField(drawId, { drawId = it }, label = { Text("Draw ID") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(customerName, { customerName = it }, label = { Text("Cliente") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(number, { number = it }, label = { Text("Número") }, modifier = Modifier.weight(1f))
            OutlinedTextField(amount, { amount = it }, label = { Text("Monto") }, modifier = Modifier.weight(1f))
            OutlinedTextField(special, { special = it }, label = { Text("Especial") }, modifier = Modifier.weight(1f))
        }
        Button(
            onClick = {
                val normalizedNumber = number.trim()
                val parsedAmount = amount.toDoubleOrNull()
                val parsedSpecial = special.toDoubleOrNull() ?: 0.0
                validationError = when {
                    !SalesInputRules.isTwoDigitNumber(normalizedNumber) -> "El número debe tener exactamente 2 dígitos."
                    parsedAmount == null || parsedAmount <= 0.0 -> "El monto regular debe ser mayor que 0."
                    parsedSpecial < 0 -> "El monto especial no puede ser negativo."
                    parsedAmount != null && parsedSpecial > parsedAmount -> "El monto especial no puede superar el monto regular."
                    drawId.isBlank() -> "Debe seleccionar/ingresar un sorteo."
                    else -> null
                }
                if (validationError != null) return@Button

                val payload = com.gameover.android.core.network.model.CreateTicketRequest(
                    drawId = drawId,
                    customerName = customerName,
                    lines = listOf(
                        com.gameover.android.core.network.model.TicketLineRequest(
                            number = normalizedNumber,
                            amount = parsedAmount ?: 0.0,
                            specialAmount = parsedSpecial,
                            isNicaEspecial = false
                        )
                    )
                )
                viewModel.submitSale(payload)
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Registrar venta") }
        Button(
            onClick = { viewModel.syncPendingSales() },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Sincronizar cola offline") }
        Text(queueStatus)
        validationError?.let { ErrorText(it) }

        when (val value = state) {
            is ResultState.Error -> ErrorText(value.error.toString())
            is ResultState.Success -> Text(value.data)
            ResultState.Loading -> CenterLoading("Registrando venta...")
        }
    }
}

@Composable
private fun TicketsRoute(viewModel: TicketsViewModel = hiltViewModel()) {
    val scope = rememberCoroutineScope()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tickets by viewModel.tickets.collectAsStateWithLifecycle()
    val printers by viewModel.printers.collectAsStateWithLifecycle()
    var codeFilter by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.load()
        viewModel.loadPrinters()
    }

    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Gestión de tickets", style = MaterialTheme.typography.titleLarge)
        OutlinedTextField(codeFilter, { codeFilter = it }, label = { Text("Buscar código") }, modifier = Modifier.fillMaxWidth())
        if (printers.isNotEmpty()) {
            Text("Impresoras Bluetooth")
            printers.forEach { printer ->
                Button(
                    onClick = { viewModel.selectPrinter(printer.address, printer.name) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("${printer.name} (${printer.address})")
                }
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(tickets.filter { codeFilter.isBlank() || it.code.contains(codeFilter, true) }) { ticket ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Código: ${ticket.code}")
                        Text("Total: ${ticket.total}")
                        Text(if (ticket.canceledAt != null) "Estado: Anulado" else "Estado: Activo")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { scope.launch { viewModel.reprint(ticket.id, ticket.canceledAt) } }) {
                                Text("Reimprimir")
                            }
                            Button(onClick = { scope.launch { viewModel.cancel(ticket.id, "Cancelado desde Android") } }) {
                                Text("Anular")
                            }
                        }
                    }
                }
            }
        }
        when (val value = state) {
            is ResultState.Error -> ErrorText(value.error.toString())
            is ResultState.Success -> Text(value.data)
            ResultState.Loading -> CenterLoading("Cargando tickets...")
        }
    }
}

@Composable
private fun WinnersReportRoute(viewModel: WinningTicketsReportViewModel = hiltViewModel()) {
    var drawId by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Ganadores (solo lectura)", style = MaterialTheme.typography.titleLarge)
        OutlinedTextField(drawId, { drawId = it }, label = { Text("Draw ID") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { if (drawId.isNotBlank()) viewModel.load(drawId) }, modifier = Modifier.fillMaxWidth()) {
            Text("Consultar")
        }
        when (val value = state) {
            is ResultState.Error -> ErrorText(value.error.toString())
            is ResultState.Success -> Text("Ganadores: ${value.data.tickets.size} | Pagados: ${value.data.paidTickets.size}")
            ResultState.Loading -> CenterLoading("Consultando...")
        }
    }
}

@Composable
private fun CommissionsRoute(viewModel: CommissionReportViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load(null, null, null, null) }

    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Comisiones (solo lectura)", style = MaterialTheme.typography.titleLarge)
        when (val value = state) {
            is ResultState.Error -> ErrorText(value.error.toString())
            is ResultState.Success -> Text("Bloques recibidos: ${value.data.keys.size}")
            ResultState.Loading -> CenterLoading("Cargando comisiones...")
        }
    }
}

@Composable
private fun CenterLoading(message: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CircularProgressIndicator()
        Spacer(modifier = Modifier.height(8.dp))
        Text(message)
    }
}

@Composable
private fun ErrorText(text: String) {
    Text(text = text, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
}
