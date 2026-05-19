package com.gameover.android.feature.settings.presentation

import android.bluetooth.BluetoothDevice
import com.gameover.android.feature.bluetooth.BtState

data class SettingsUiState(
    val pairedDevices: List<BluetoothDevice> = emptyList(),
    val connectionState: BtState = BtState.Disconnected,
    val isBluetoothEnabled: Boolean = false,
    val savedPrinterName: String = "",
    val savedPrinterAddress: String = "",
    val statusMessage: String? = null,
    val isTestPrinting: Boolean = false,
)
