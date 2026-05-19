package com.gameover.android.core.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "gameover_prefs")

@Singleton
class TokenDataStore @Inject constructor(@ApplicationContext private val context: Context) {

    companion object {
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_JSON = stringPreferencesKey("user_json")
        val PRINTER_NAME = stringPreferencesKey("printer_name")
        val PRINTER_ADDRESS = stringPreferencesKey("printer_address")
    }

    /** In-memory cache to avoid runBlocking in OkHttp interceptor. Updated on every token save/clear. */
    private val _cachedAccessToken = AtomicReference<String?>(null)
    private val _cachedRefreshToken = AtomicReference<String?>(null)

    val accessToken: Flow<String?> = context.dataStore.data.map { it[ACCESS_TOKEN] }
    val refreshToken: Flow<String?> = context.dataStore.data.map { it[REFRESH_TOKEN] }
    val userJson: Flow<String?> = context.dataStore.data.map { it[USER_JSON] }
    val printerAddress: Flow<String?> = context.dataStore.data.map { it[PRINTER_ADDRESS] }
    val printerName: Flow<String?> = context.dataStore.data.map { it[PRINTER_NAME] }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        _cachedAccessToken.set(accessToken)
        _cachedRefreshToken.set(refreshToken)
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = accessToken
            prefs[REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun saveUser(userJson: String) {
        context.dataStore.edit { prefs -> prefs[USER_JSON] = userJson }
    }

    suspend fun savePrinter(name: String, address: String) {
        context.dataStore.edit { prefs ->
            prefs[PRINTER_NAME] = name
            prefs[PRINTER_ADDRESS] = address
        }
    }

    suspend fun clearSession() {
        _cachedAccessToken.set(null)
        _cachedRefreshToken.set(null)
        context.dataStore.edit { prefs ->
            prefs.remove(ACCESS_TOKEN)
            prefs.remove(REFRESH_TOKEN)
            prefs.remove(USER_JSON)
        }
    }

    /**
     * Returns the in-memory cached access token (non-blocking, safe for OkHttp interceptor).
     * Falls back to a blocking DataStore read only if the cache is empty (app cold start).
     */
    fun getCachedAccessToken(): String? = _cachedAccessToken.get()
    fun getCachedRefreshToken(): String? = _cachedRefreshToken.get()

    suspend fun getAccessTokenOnce(): String? {
        val cached = _cachedAccessToken.get()
        if (cached != null) return cached
        val stored = context.dataStore.data.first()[ACCESS_TOKEN]
        _cachedAccessToken.compareAndSet(null, stored)
        return stored
    }

    suspend fun getRefreshTokenOnce(): String? {
        val cached = _cachedRefreshToken.get()
        if (cached != null) return cached
        val stored = context.dataStore.data.first()[REFRESH_TOKEN]
        _cachedRefreshToken.compareAndSet(null, stored)
        return stored
    }
}
