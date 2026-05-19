package com.gameover.android.core.database.repository

import com.gameover.android.core.database.dao.SessionDao
import com.gameover.android.core.database.entity.SessionEntity
import javax.inject.Inject

data class CachedSession(
    val userId: String,
    val username: String,
    val role: String,
    val permissions: List<String>
)

class SessionLocalRepository @Inject constructor(
    private val dao: SessionDao
) {
    suspend fun save(session: CachedSession) {
        dao.upsert(
            SessionEntity(
                userId = session.userId,
                username = session.username,
                role = session.role,
                permissionsCsv = session.permissions.joinToString(","),
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun read(): CachedSession? {
        val session = dao.getSession() ?: return null
        val permissions = session.permissionsCsv
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        return CachedSession(
            userId = session.userId,
            username = session.username,
            role = session.role,
            permissions = permissions
        )
    }

    suspend fun clear() {
        dao.clear()
    }
}
