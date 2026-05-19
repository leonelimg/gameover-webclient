package com.gameover.android.feature.sales.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.gameover.android.core.domain.repository.CreateTicketLine
import com.gameover.android.core.domain.repository.OfflineQueueRepository
import com.gameover.android.core.domain.repository.TicketsRepository
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted workerParams: WorkerParameters,
    private val offlineQueueRepository: OfflineQueueRepository,
    private val ticketsRepository: TicketsRepository,
    private val gson: Gson,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "SyncOfflineSalesWorker"
        const val CHANNEL_ID = "sync_channel"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val pending = offlineQueueRepository.getPending()
        if (pending.isEmpty()) return@withContext Result.success()

        var allSuccess = true
        for (sale in pending) {
            try {
                val linesType = object : TypeToken<List<CreateTicketLine>>() {}.type
                val lines: List<CreateTicketLine> = gson.fromJson(sale.linesJson, linesType)
                ticketsRepository.createTicket(sale.drawId, sale.customerName, lines)
                offlineQueueRepository.markSuccess(sale.id)
                showNotification("Venta sincronizada", "Ticket registrado correctamente.")
            } catch (e: Exception) {
                // Business logic errors (4xx): do not retry
                val errorMsg = e.message ?: "Error desconocido"
                val isRetryable = e is java.net.ConnectException ||
                    e is java.net.SocketTimeoutException ||
                    e is java.net.UnknownHostException ||
                    errorMsg.contains("server error", ignoreCase = true) ||
                    errorMsg.contains("500") || errorMsg.contains("502") ||
                    errorMsg.contains("503") || errorMsg.contains("504")
                val newRetryCount = sale.retryCount + 1
                if (newRetryCount >= 5 || !isRetryable) {
                    offlineQueueRepository.markFailed(sale.id, errorMsg, newRetryCount)
                    showNotification("Error en venta offline", "No se pudo sincronizar la venta: $errorMsg")
                } else {
                    offlineQueueRepository.markFailed(sale.id, errorMsg, newRetryCount)
                    allSuccess = false
                }
            }
        }
        if (!allSuccess) Result.retry() else Result.success()
    }

    private fun showNotification(title: String, message: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Sincronización", NotificationManager.IMPORTANCE_DEFAULT)
            notificationManager.createNotificationChannel(channel)
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .build()
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
