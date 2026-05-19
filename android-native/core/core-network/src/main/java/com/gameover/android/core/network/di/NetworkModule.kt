package com.gameover.android.core.network.di

import com.gameover.android.core.network.api.*
import com.gameover.android.core.network.interceptor.AuthInterceptor
import com.gameover.android.core.network.interceptor.TokenAuthenticator
import com.google.gson.GsonBuilder
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

// Token providers and base URL are bound in :core:core-data via @Named qualifiers
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    @Named("auth")
    fun provideAuthRetrofit(
        @Named("baseUrl") baseUrl: String,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    @Provides
    @Singleton
    fun provideAuthApi(@Named("auth") retrofit: Retrofit): AuthApi =
        retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .authenticator(tokenAuthenticator)
        .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    @Named("main")
    fun provideMainRetrofit(
        @Named("baseUrl") baseUrl: String,
        client: OkHttpClient,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(GsonBuilder().serializeNulls().create()))
        .build()

    @Provides
    @Singleton
    fun provideDrawsApi(@Named("main") retrofit: Retrofit): DrawsApi =
        retrofit.create(DrawsApi::class.java)

    @Provides
    @Singleton
    fun provideTicketsApi(@Named("main") retrofit: Retrofit): TicketsApi =
        retrofit.create(TicketsApi::class.java)

    @Provides
    @Singleton
    fun provideReportsApi(@Named("main") retrofit: Retrofit): ReportsApi =
        retrofit.create(ReportsApi::class.java)
}
