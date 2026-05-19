package com.gameover.android.core.network

import android.content.Context
import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.auth.AuthInterceptor
import com.gameover.android.core.network.auth.AuthSessionManager
import com.gameover.android.core.network.auth.SecureTokenStorage
import com.gameover.android.core.network.auth.TokenAuthenticator
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideBaseUrl(): String = NetworkConfig.BASE_URL

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideTokenStorage(@ApplicationContext context: Context): SecureTokenStorage {
        return SecureTokenStorage(context)
    }

    @Provides
    @Singleton
    fun provideAuthApi(
        baseUrl: String,
        client: OkHttpClient,
        moshi: Moshi
    ): AuthApi {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(AuthApi::class.java)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        interceptor: AuthInterceptor,
        authenticator: TokenAuthenticator
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(interceptor)
            .authenticator(authenticator)
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideBusinessApi(
        baseUrl: String,
        client: OkHttpClient,
        moshi: Moshi
    ): BusinessApi {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(BusinessApi::class.java)
    }
}
