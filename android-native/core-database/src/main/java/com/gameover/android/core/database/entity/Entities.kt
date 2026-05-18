package com.gameover.android.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "session")
data class SessionEntity(
    @PrimaryKey val id: Int = 1,
    val userId: String,
    val username: String,
    val role: String,
    val permissionsCsv: String,
    val updatedAt: Long
)

@Entity(tableName = "draw_cache")
data class DrawCacheEntity(
    @PrimaryKey val id: String,
    val name: String,
    val closeTime: String,
    val minutosPreviosCierre: Int,
    val status: String,
    val restrictedNumbersJson: String,
    val updatedAt: Long
)

@Entity(tableName = "recent_tickets")
data class RecentTicketEntity(
    @PrimaryKey val id: String,
    val code: String,
    val drawId: String,
    val total: Double,
    val createdAt: String,
    val canceledAt: String?
)

@Entity(tableName = "summary_cache")
data class SummaryCacheEntity(
    @PrimaryKey val id: Int = 1,
    val payloadJson: String,
    val fromDate: String?,
    val toDate: String?,
    val updatedAt: Long
)

@Entity(tableName = "pending_sales")
data class PendingSaleEntity(
    @PrimaryKey val id: String,
    val payloadJson: String,
    val createdAt: Long,
    val attempts: Int,
    val status: String,
    val lastError: String?
)

@Entity(tableName = "printer_device")
data class PrinterDeviceEntity(
    @PrimaryKey val macAddress: String,
    val name: String,
    val lastConnectedAt: Long?
)

@Entity(tableName = "print_jobs")
data class PrintJobEntity(
    @PrimaryKey val id: String,
    val ticketJson: String,
    val status: String,
    val attempts: Int,
    val maxAttempts: Int,
    val nextAttemptAt: Long,
    val lastError: String?
)
