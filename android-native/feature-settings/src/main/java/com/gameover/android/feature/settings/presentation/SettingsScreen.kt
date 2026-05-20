package com.gameover.android.feature.settings.presentation

import android.annotation.SuppressLint
import android.Manifest
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.ui.component.*
import com.gameover.android.core.ui.theme.GoNeutral
import com.gameover.android.core.ui.theme.GoSuccess
import com.gameover.android.feature.bluetooth.BtState

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("MissingPermission")
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var hasBluetoothPermissions by remember { mutableStateOf(hasRequiredBluetoothPermissions(context)) }
    val bluetoothPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        val granted = requiredBluetoothPermissions().all { permission -> result[permission] == true }
        hasBluetoothPermissions = granted
        if (granted) {
            viewModel.loadPairedDevices()
        }
    }

    LaunchedEffect(Unit) {
        hasBluetoothPermissions = hasRequiredBluetoothPermissions(context)
    }

    LaunchedEffect(uiState.statusMessage) {
        uiState.statusMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearStatus()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Configuración",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Bluetooth section header
            item {
                Text(
                    "Impresora Bluetooth",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            // Bluetooth status
            item {
                GoCard(elevation = 2f) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(
                                Icons.Default.Bluetooth,
                                contentDescription = null,
                                tint = if (uiState.isBluetoothEnabled) GoSuccess else GoNeutral,
                                modifier = Modifier.size(24.dp)
                            )
                            Column {
                                Text(
                                    if (uiState.isBluetoothEnabled) "Bluetooth activado" else "Bluetooth desactivado",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                    style = MaterialTheme.typography.labelLarge
                                )
                            }
                        }
                        GoButton(
                            text = "Actualizar",
                            onClick = {
                                if (hasBluetoothPermissions) {
                                    viewModel.loadPairedDevices()
                                } else {
                                    bluetoothPermissionLauncher.launch(requiredBluetoothPermissions())
                                }
                            },
                            variant = ButtonVariant.TEXT,
                        )
                    }
                }
            }

            if (!hasBluetoothPermissions) {
                item {
                    ErrorBanner(message = "Se requieren permisos Bluetooth para usar impresoras")
                }
                item {
                    GoButton(
                        text = "Conceder permisos Bluetooth",
                        onClick = { bluetoothPermissionLauncher.launch(requiredBluetoothPermissions()) },
                        modifier = Modifier.fillMaxWidth(),
                        variant = ButtonVariant.OUTLINED,
                    )
                }
            }

            // Warning if BT disabled
            if (!uiState.isBluetoothEnabled) {
                item {
                    ErrorBanner(message = "Habilita Bluetooth para usar la impresora")
                }
            }

            // Connection status banner
            val connState = uiState.connectionState
            if (connState is BtState.Connected) {
                item {
                    GoCard(elevation = 4f) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text("Conectado a:", fontSize = 12.sp, color = GoNeutral, style = MaterialTheme.typography.labelSmall)
                                Text(connState.deviceName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, style = MaterialTheme.typography.labelLarge)
                                Text(connState.deviceAddress, fontSize = 11.sp, color = GoNeutral, style = MaterialTheme.typography.bodySmall)
                            }
                            GoBadge("Conectado", BadgeVariant.SUCCESS)
                        }
                    }
                }
            }

            if (connState is BtState.Error) {
                item { ErrorBanner(message = connState.message) }
            }

            // Paired devices
            if (uiState.isBluetoothEnabled && hasBluetoothPermissions) {
                item {
                    Text(
                        "Dispositivos emparejados",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.titleSmall
                    )
                }

                if (uiState.pairedDevices.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.Bluetooth,
                                    contentDescription = null,
                                    modifier = Modifier.size(40.dp),
                                    tint = GoNeutral
                                )
                                Text(
                                    "No hay dispositivos emparejados",
                                    color = GoNeutral,
                                    fontSize = 13.sp,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                }

                items(uiState.pairedDevices, key = { it.address }) { device ->
                    DeviceListItem(
                        device = device,
                        isConnected = connState is BtState.Connected && connState.deviceAddress == device.address,
                        isConnecting = connState is BtState.Connecting,
                        onConnect = { viewModel.connectDevice(device) },
                        onDisconnect = viewModel::disconnectDevice,
                    )
                }
            }

            // Test print button
            if (connState is BtState.Connected) {
                item {
                    GoButton(
                        text = "Prueba de Impresión",
                        onClick = viewModel::testPrint,
                        modifier = Modifier.fillMaxWidth(),
                        loading = uiState.isTestPrinting,
                        variant = ButtonVariant.OUTLINED,
                    )
                }
            }
        }
    }
}

private fun requiredBluetoothPermissions(): Array<String> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return emptyArray()
    return arrayOf(
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN,
    )
}

private fun hasRequiredBluetoothPermissions(context: Context): Boolean {
    return requiredBluetoothPermissions().all { permission ->
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    }
}

@SuppressLint("MissingPermission")
@Composable
private fun DeviceListItem(
    device: BluetoothDevice,
    isConnected: Boolean,
    isConnecting: Boolean,
    onConnect: () -> Unit,
    onDisconnect: () -> Unit,
) {
    GoCard(elevation = 2f) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        Icons.Default.BluetoothAudio,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (isConnected) GoSuccess else GoNeutral
                    )
                    Text(
                        device.name ?: "Dispositivo desconocido",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        style = MaterialTheme.typography.labelLarge
                    )
                }
                Text(device.address, fontSize = 11.sp, color = GoNeutral, style = MaterialTheme.typography.bodySmall)
            }
            if (isConnected) {
                GoBadge("Conectado", BadgeVariant.SUCCESS)
            }
        }
        if (isConnected) {
            Spacer(modifier = Modifier.height(8.dp))
            GoButton(
                text = "Desconectar",
                onClick = onDisconnect,
                variant = ButtonVariant.OUTLINED,
                modifier = Modifier.fillMaxWidth()
            )
        } else if (!isConnecting) {
            Spacer(modifier = Modifier.height(8.dp))
            GoButton(
                text = "Conectar",
                onClick = onConnect,
                variant = ButtonVariant.SECONDARY,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
