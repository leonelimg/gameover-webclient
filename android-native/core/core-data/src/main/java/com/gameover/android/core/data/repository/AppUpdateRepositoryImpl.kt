package com.gameover.android.core.data.repository

import com.gameover.android.core.data.local.UpdatePreferences
import com.gameover.android.core.domain.model.AppUpdateInfo
import com.gameover.android.core.domain.repository.AppUpdateRepository
import com.gameover.android.core.network.api.AppUpdateApi
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdateRepositoryImpl @Inject constructor(
    private val api: AppUpdateApi,
    private val prefs: UpdatePreferences
) : AppUpdateRepository {

    override suspend fun checkForUpdate(forceCheck: Boolean): Result<AppUpdateInfo?> {
        val currentTime = System.currentTimeMillis()
        val lastCheck = prefs.getLastCheckTime()
        val sevenDaysInMillis = TimeUnit.DAYS.toMillis(7)

        // Si no se fuerza el chequeo y no han pasado 7 días, evitamos la llamada de red
        if (!forceCheck && currentTime - lastCheck < sevenDaysInMillis && lastCheck != 0L) {
            return Result.success(null)
        }

        return try {
            val response = api.getLatestVersion()
            if (response.isSuccessful && response.body() != null) {
                prefs.saveLastCheckTime(currentTime)
                val dto = response.body()!!
                val domainModel = AppUpdateInfo(
                    versionCode = dto.versionCode,
                    versionName = dto.versionName,
                    apkUrl = dto.apkUrl,
                    isMandatory = dto.isMandatory,
                    releaseNotes = dto.releaseNotes
                )
                Result.success(domainModel)
            } else {
                Result.failure(Exception("Error en respuesta del servidor"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
