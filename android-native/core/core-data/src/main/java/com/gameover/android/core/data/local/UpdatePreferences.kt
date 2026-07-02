package com.gameover.android.core.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UpdatePreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences("app_update_prefs", Context.MODE_PRIVATE)

    fun getLastCheckTime(): Long {
        return prefs.getLong("last_check_time", 0L)
    }

    fun saveLastCheckTime(timestamp: Long) {
        prefs.edit().putLong("last_check_time", timestamp).apply()
    }
}
