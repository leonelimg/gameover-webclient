package com.gameover.android.feature.settings.presentation

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.statusMessage) {
        uiState.statusMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearStatus()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Configuración") })
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
            // Bluetooth section header
            item {
                Text("Impresora Bluetooth", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }

            // Bluetooth status
            item {
                GoCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                Icons.Default.Bluetooth,
                                contentDescription = null,
                                tint = if (uiState.isBluetoothEnabled) GoSuccess else GoNeutral,
                            )
                            Text(
                                if (uiState.isBluetoothEnabled) "Bluetooth activado" else "Bluetooth desactivado",
                                fontSize = 14.sp,
                            )
                        }
                        GoButton(
                            text = "Actualizar",
                            onClick = viewModel::loadPairedDevices,
                            variant = ButtonVariant.TEXT,
                        )
                    }
                }
            }

            // Warning if BT disabled
            if (!uiState.isBluetoothEnabled) {
                item {
                    ErrorBanner(message = "Habilita el Bluetooth para usar la impresora")
                }
            }

            // Connection status banner
            val connState = uiState.connectionState
            if (connState is BtState.Connected) {
                item {
                    GoCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text("Conectado a:", fontSize = 12.sp, color = GoNeutral)
                                Text(connState.deviceName, fontWeight = FontWeight.Medium)
                                Text(connState.deviceAddress, fontSize = 11.sp, color = GoNeutral)
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
            if (uiState.isBluetoothEnabled) {
                item {
                    Text("Dispositivos emparejados", fontSize = 14.sp, color = GoNeutral, fontWeight = FontWeight.Medium)
                }

                if (uiState.pairedDevices.isEmpty()) {
                    item {
                        Text("No hay dispositivos emparejados.", color = GoNeutral, fontSize = 13.sp)
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

@SuppressLint("MissingPermission")
@Composable
private fun DeviceListItem(
    device: BluetoothDevice,
    isConnected: Boolean,
    isConnecting: Boolean,
    onConnect: () -> Unit,
    onDisconnect: () -> Unit,
) {
    GoCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(device.name ?: "Dispositivo desconocido", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Text(device.address, fontSize = 11.sp, color = GoNeutral)
            }
            if (isConnected) {
                GoButton(text = "Desconectar", onClick = onDisconnect, variant = ButtonVariant.TEXT)
            } else {
                GoButton(
                    text = "Conectar",
                    onClick = onConnect,
                    loading = isConnecting,
                    variant = ButtonVariant.OUTLINED,
                )
            }
        }
    }
}
