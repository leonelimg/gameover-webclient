package com.gameover.android.core.database.repository

import com.gameover.android.core.database.dao.RecentTicketDao
import com.gameover.android.core.database.dao.SummaryCacheDao
import com.gameover.android.core.database.entity.RecentTicketEntity
import com.gameover.android.core.database.entity.SummaryCacheEntity
import javax.inject.Inject
import org.json.JSONArray
import org.json.JSONObject

data class CachedSummary(
    val payloadJson: String,
    val fromDate: String?,
    val toDate: String?
)

class DashboardCacheRepository @Inject constructor(
    private val summaryDao: SummaryCacheDao,
    private val recentTicketDao: RecentTicketDao
) {
    suspend fun cacheSummary(payloadJson: String, fromDate: String?, toDate: String?) {
        summaryDao.upsert(
            SummaryCacheEntity(
                payloadJson = payloadJson,
                fromDate = fromDate,
                toDate = toDate,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun readSummary(fromDate: String?, toDate: String?): CachedSummary? {
        val cached = summaryDao.get() ?: return null
        if (cached.fromDate != fromDate || cached.toDate != toDate) return null
        return CachedSummary(cached.payloadJson, cached.fromDate, cached.toDate)
    }

    suspend fun cacheRecentTickets(items: List<Map<String, Any?>>) {
        val entities = items.mapNotNull { item ->
            val id = item["id"]?.toString() ?: return@mapNotNull null
            RecentTicketEntity(
                id = id,
                code = item["code"]?.toString().orEmpty(),
                drawId = item["drawId"]?.toString().orEmpty(),
                total = (item["total"] as? Number)?.toDouble() ?: 0.0,
                createdAt = item["createdAt"]?.toString().orEmpty(),
                canceledAt = item["canceledAt"]?.toString()
            )
        }
        recentTicketDao.clear()
        recentTicketDao.upsert(entities)
    }

    suspend fun readRecentTickets(limit: Int = 5): List<Map<String, Any?>> {
        return recentTicketDao.list(limit).map {
            mapOf(
                "id" to it.id,
                "code" to it.code,
                "drawId" to it.drawId,
                "total" to it.total,
                "createdAt" to it.createdAt,
                "canceledAt" to it.canceledAt
            )
        }
    }

    companion object {
        fun summaryToJson(map: Map<String, Any?>): String {
            return JSONObject(map).toString()
        }

        fun summaryFromJson(raw: String): Map<String, Any?> {
            val json = JSONObject(raw)
            val result = mutableMapOf<String, Any?>()
            json.keys().forEach { key ->
                val value = json.get(key)
                result[key] = if (value is JSONArray) value.toString() else value
            }
            return result
        }
    }
}
