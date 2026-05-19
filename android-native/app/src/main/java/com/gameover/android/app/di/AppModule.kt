package com.gameover.android.app.di

import android.content.Context
import com.gameover.android.app.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Named
import javax.inject.Singleton

// NOTE: Only AppModule provides @Named("baseUrl"). DataModule must NOT provide the same binding
// to avoid a Hilt duplicate binding conflict at compile time.
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Named("baseUrl")
    @Singleton
    fun provideBaseUrl(): String = BuildConfig.API_BASE_URL.let {
        if (it.endsWith("/")) it else "$it/"
    }
}
