package com.gameover.android.core.print

import com.gameover.android.core.bluetooth.BluetoothPrinterManager
import com.gameover.android.core.database.repository.PrintQueueRepository
import com.gameover.android.core.database.repository.PrinterDeviceRepository
import com.squareup.moshi.Moshi
import javax.inject.Inject

class NativePrintQueueProcessor @Inject constructor(
    private val queueRepository: PrintQueueRepository,
    private val printerDeviceRepository: PrinterDeviceRepository,
    private val printerManager: BluetoothPrinterManager
) {
    private val moshi = Moshi.Builder().build()
    private val ticketAdapter = moshi.adapter(EscPosTicket::class.java)

    suspend fun enqueue(ticket: EscPosTicket): String {
        val payload = ticketAdapter.toJson(ticket)
        return queueRepository.enqueue(payload)
    }

    suspend fun processQueue() {
        val jobs = queueRepository.nextPending()
        val printer = printerDeviceRepository.latest()
            ?: return

        runCatching { if (!printerManager.isConnected()) printerManager.connect(printer.macAddress) }
            .onFailure {
                jobs.forEach { job ->
                    handleRetry(job, it.message ?: "No se pudo conectar a impresora")
                }
                return
            }

        jobs.forEach { job ->
            val attempt = job.attempts + 1
            queueRepository.markProcessing(job.id, attempt)
            runCatching {
                val ticket = requireNotNull(ticketAdapter.fromJson(job.ticketJson))
                val bytes = EscPosFormatter.build(ticket)
                printerManager.printRaw(bytes)
                queueRepository.markCompleted(job.id)
            }.onFailure {
                handleRetry(job, it.message ?: "Error imprimiendo")
            }
        }
    }

    private suspend fun handleRetry(job: com.gameover.android.core.database.entity.PrintJobEntity, error: String) {
        val attempt = job.attempts + 1
        val next = System.currentTimeMillis() + PrintRetryPolicy.nextDelayMs(attempt)
        if (attempt >= job.maxAttempts) {
            queueRepository.markFailed(job.id, attempt, error)
        } else {
            queueRepository.markRetrying(job.id, attempt, next, error)
        }
    }
}
