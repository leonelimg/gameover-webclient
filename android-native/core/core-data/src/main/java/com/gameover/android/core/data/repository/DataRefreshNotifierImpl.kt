package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.repository.DataRefreshNotifier
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DataRefreshNotifierImpl @Inject constructor() : DataRefreshNotifier {
    private val _refreshEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    override val refreshEvents: Flow<Unit> = _refreshEvents

    override suspend fun notifyDataChanged() {
        _refreshEvents.emit(Unit)
    }
}

