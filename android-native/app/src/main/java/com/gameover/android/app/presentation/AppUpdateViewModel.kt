package com.gameover.android.app.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.BuildConfig
import com.gameover.android.core.domain.model.AppUpdateInfo
import com.gameover.android.core.domain.repository.AppUpdateRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val repository: AppUpdateRepository
) : ViewModel() {

    private val _updateState = MutableStateFlow<AppUpdateInfo?>(null)
    val updateState: StateFlow<AppUpdateInfo?> = _updateState.asStateFlow()

    fun checkForUpdates() {
        viewModelScope.launch {
            repository.checkForUpdate(forceCheck = false).onSuccess { updateInfo ->
                if (updateInfo != null && updateInfo.versionCode > BuildConfig.VERSION_CODE) {
                    _updateState.value = updateInfo
                }
            }
        }
    }

    fun dismissUpdate() {
        _updateState.value = null
    }
}
