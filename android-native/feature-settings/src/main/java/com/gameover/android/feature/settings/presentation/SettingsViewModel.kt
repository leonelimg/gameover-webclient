package com.gameover.android.feature.settings.presentation

import android.bluetooth.BluetoothDevice
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.content.Context
import com.gameover.android.core.data.local.TokenDataStore
import com.gameover.android.core.domain.repository.AppUpdateRepository
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.feature.bluetooth.BluetoothPrinterManager
import com.gameover.android.feature.bluetooth.BtState
import com.gameover.android.feature.bluetooth.escpos.EscPosBuilder
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val bluetoothPrinterManager: BluetoothPrinterManager,
    private val tokenDataStore: TokenDataStore,
    private val authRepository: AuthRepository,
    private val appUpdateRepository: AppUpdateRepository,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadPairedDevices()
        viewModelScope.launch {
            bluetoothPrinterManager.connectionState.collect { state ->
                _uiState.update { it.copy(connectionState = state) }
            }
        }
        viewModelScope.launch {
            tokenDataStore.printerName.collect { name ->
                _uiState.update { it.copy(savedPrinterName = name ?: "") }
            }
        }
        viewModelScope.launch {
            tokenDataStore.printerAddress.collect { address ->
                _uiState.update { it.copy(savedPrinterAddress = address ?: "") }
            }
        }
    }

    fun loadPairedDevices() {
        val enabled = bluetoothPrinterManager.isBluetoothEnabled()
        val devices = if (enabled) bluetoothPrinterManager.getPairedDevices() else emptyList()
        _uiState.update { it.copy(pairedDevices = devices, isBluetoothEnabled = enabled) }
    }

    @Suppress("MissingPermission")
    fun connectDevice(device: BluetoothDevice) {
        viewModelScope.launch {
            val success = bluetoothPrinterManager.connect(device)
            if (success) {
                tokenDataStore.savePrinter(device.name ?: "Impresora", device.address)
                _uiState.update { it.copy(statusMessage = "Conectado a ${device.name}") }
            } else {
                _uiState.update { it.copy(statusMessage = "No se pudo conectar a ${device.name}") }
            }
        }
    }

    fun disconnectDevice() {
        bluetoothPrinterManager.disconnect()
        _uiState.update { it.copy(statusMessage = "Desconectado") }
    }

    fun testPrint() {
        _uiState.update { it.copy(isTestPrinting = true) }
        viewModelScope.launch {
            val data = EscPosBuilder()
                .init()
                .alignCenter()
                .boldOn()
                .textLn("GameOver Lotería")
                .boldOff()
                .textLn("--- Prueba de Impresión ---")
                .textLn("Impresora configurada correctamente")
                .lineFeed(3)
                .partialCut()
                .build()
            val result = bluetoothPrinterManager.print(data)
            _uiState.update { it.copy(
                isTestPrinting = false,
                statusMessage = if (result.isSuccess) "Impresión de prueba exitosa" else "Error: ${result.exceptionOrNull()?.message}",
            )}
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }

    fun clearStatus() = _uiState.update { it.copy(statusMessage = null) }

    fun checkForUpdates() {
        _uiState.update { it.copy(isCheckingUpdates = true) }
        viewModelScope.launch {
            appUpdateRepository.checkForUpdate(forceCheck = true)
                .onSuccess { updateInfo ->
                    _uiState.update { it.copy(isCheckingUpdates = false) }
                    if (updateInfo != null) {
                        val currentVersionCode = getAppVersionCode()
                        if (updateInfo.versionCode > currentVersionCode) {
                            _uiState.update { it.copy(updateInfo = updateInfo) }
                        } else {
                            _uiState.update { it.copy(statusMessage = "La aplicación está actualizada") }
                        }
                    } else {
                        _uiState.update { it.copy(statusMessage = "La aplicación está actualizada") }
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isCheckingUpdates = false,
                            statusMessage = "Error al buscar actualizaciones: ${error.message}"
                        )
                    }
                }
        }
    }

    fun dismissUpdateDialog() {
        _uiState.update { it.copy(updateInfo = null) }
    }

    private fun getAppVersionCode(): Long {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode.toLong()
            }
        } catch (e: Exception) {
            0L
        }
    }

    fun getAppVersionName(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "Desconocida"
        } catch (e: Exception) {
            "Desconocida"
        }
    }
}
