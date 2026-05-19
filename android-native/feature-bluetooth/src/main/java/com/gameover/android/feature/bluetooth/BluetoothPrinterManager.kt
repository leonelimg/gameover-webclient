package com.gameover.android.feature.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

sealed class BtState {
    object Disconnected : BtState()
    object Connecting : BtState()
    data class Connected(val deviceName: String, val deviceAddress: String) : BtState()
    data class Error(val message: String) : BtState()
}

@Singleton
class BluetoothPrinterManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val MAX_RETRIES = 3
        private const val RETRY_DELAY_MS = 1000L
    }

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var socket: BluetoothSocket? = null

    private val _connectionState = MutableStateFlow<BtState>(BtState.Disconnected)
    val connectionState: StateFlow<BtState> = _connectionState.asStateFlow()

    @SuppressLint("MissingPermission")
    fun getPairedDevices(): List<BluetoothDevice> {
        return bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
    }

    @SuppressLint("MissingPermission")
    suspend fun connect(device: BluetoothDevice): Boolean = withContext(Dispatchers.IO) {
        _connectionState.value = BtState.Connecting
        disconnect()

        var lastException: Exception? = null
        repeat(MAX_RETRIES) { attempt ->
            try {
                val btSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                bluetoothAdapter?.cancelDiscovery()
                btSocket.connect()
                socket = btSocket
                _connectionState.value = BtState.Connected(
                    deviceName = device.name ?: "Impresora",
                    deviceAddress = device.address,
                )
                return@withContext true
            } catch (e: IOException) {
                lastException = e
                if (attempt < MAX_RETRIES - 1) delay(RETRY_DELAY_MS)
            }
        }
        _connectionState.value = BtState.Error(lastException?.message ?: "No se pudo conectar a la impresora")
        false
    }

    fun disconnect() {
        try {
            socket?.close()
        } catch (_: IOException) {}
        socket = null
        if (_connectionState.value !is BtState.Connecting) {
            _connectionState.value = BtState.Disconnected
        }
    }

    suspend fun print(data: ByteArray): Result<Unit> = withContext(Dispatchers.IO) {
        val s = socket
        if (s == null || !s.isConnected) {
            return@withContext Result.failure(IOException("No hay conexión con la impresora"))
        }
        try {
            s.outputStream.write(data)
            s.outputStream.flush()
            Result.success(Unit)
        } catch (e: IOException) {
            _connectionState.value = BtState.Error("Error al imprimir: ${e.message}")
            disconnect()
            Result.failure(e)
        }
    }

    fun isConnected(): Boolean = socket?.isConnected == true

    @SuppressLint("MissingPermission")
    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled == true
}
