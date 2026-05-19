package com.gameover.android.core.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_sale")
data class PendingSaleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val drawId: String,
    val customerName: String,
    val linesJson: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0,
    val lastError: String? = null,
    val status: String = "pending", // pending, failed
)
