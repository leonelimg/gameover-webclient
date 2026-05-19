package com.gameover.android.feature.bluetooth.di

import com.gameover.android.feature.bluetooth.BluetoothPrinterManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

// BluetoothPrinterManager is annotated @Singleton @Inject constructor, so Hilt auto-provides it.
// This module is intentionally minimal.
@Module
@InstallIn(SingletonComponent::class)
object BluetoothModule
