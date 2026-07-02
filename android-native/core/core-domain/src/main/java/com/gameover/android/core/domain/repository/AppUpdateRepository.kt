package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.AppUpdateInfo

interface AppUpdateRepository {
    suspend fun checkForUpdate(forceCheck: Boolean = false): Result<AppUpdateInfo?>
}
