package com.gameover.android.core.database.repository

import com.gameover.android.core.database.dao.PrinterDeviceDao
import com.gameover.android.core.database.entity.PrinterDeviceEntity
import javax.inject.Inject

class PrinterDeviceRepository @Inject constructor(
    private val dao: PrinterDeviceDao
) {
    suspend fun save(macAddress: String, name: String) {
        dao.upsert(
            PrinterDeviceEntity(
                macAddress = macAddress,
                name = name,
                lastConnectedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun latest(): PrinterDeviceEntity? = dao.list().firstOrNull()
    suspend fun list(): List<PrinterDeviceEntity> = dao.list()
}
