package com.gameover.android.feature.reports.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.network.api.BusinessApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class CommissionReportViewModel(
    private val businessApi: BusinessApi
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<Map<String, Any?>>>(ResultState.Loading)
    val state: StateFlow<ResultState<Map<String, Any?>>> = _state

    fun load(drawId: String?, userId: String?, fromDate: String?, toDate: String?) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                ResultState.Success(businessApi.balanceBreakdown(drawId, userId, fromDate, toDate))
            }.getOrElse {
                ResultState.Error(AppError.Network(it.message ?: "No se pudo cargar comisiones"))
            }
        }
    }
}
