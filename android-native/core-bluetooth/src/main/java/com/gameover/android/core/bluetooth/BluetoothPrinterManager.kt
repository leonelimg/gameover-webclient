package com.gameover.android.core.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import java.io.IOException
import java.util.UUID

private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")

data class BluetoothPrinterDevice(
    val name: String,
    val address: String
)

class BluetoothPrinterManager(private val context: Context) {
    private val adapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var socket: BluetoothSocket? = null

    fun pairedPrinters(): List<BluetoothPrinterDevice> {
        if (!hasConnectPermission()) return emptyList()
        val bonded = adapter?.bondedDevices ?: emptySet()
        return bonded.map { BluetoothPrinterDevice(it.name ?: "Printer", it.address) }
    }

    @Throws(SecurityException::class, IOException::class)
    fun connect(address: String) {
        if (!hasConnectPermission()) {
            throw SecurityException("Permiso BLUETOOTH_CONNECT requerido")
        }
        val device = adapter?.getRemoteDevice(address)
            ?: throw IOException("Impresora no encontrada")
        socket?.closeSilently()
        socket = device.createRfcommSocketToServiceRecord(SPP_UUID).apply { connect() }
    }

    @Throws(IOException::class)
    fun printRaw(bytes: ByteArray) {
        val out = socket?.outputStream ?: throw IOException("Impresora no conectada")
        out.write(bytes)
        out.flush()
    }

    fun disconnect() {
        socket?.closeSilently()
        socket = null
    }

    private fun hasConnectPermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun BluetoothSocket.closeSilently() {
        runCatching { close() }
    }
}
