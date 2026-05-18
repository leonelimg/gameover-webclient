package com.gameover.android.core.network.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecureTokenStorage(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "go_secure_session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun getAccess(): String? = prefs.getString(KEY_ACCESS, null)
    fun getRefresh(): String? = prefs.getString(KEY_REFRESH, null)

    fun set(access: String, refresh: String) {
        prefs.edit().putString(KEY_ACCESS, access).putString(KEY_REFRESH, refresh).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_ACCESS).remove(KEY_REFRESH).apply()
    }

    companion object {
        private const val KEY_ACCESS = "go_access_token"
        private const val KEY_REFRESH = "go_refresh_token"
    }
}
