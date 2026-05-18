package com.gameover.android.app

import android.app.Application
import com.gameover.android.core.common.logging.AppLogger
import com.gameover.android.core.common.logging.TimberLogger

class GameOverApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppLogger.init(TimberLogger())
    }
}
