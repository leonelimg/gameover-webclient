package com.gameover.android.feature.reports.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.network.NetworkErrorMapper
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.model.WinningTicketsResponseDto
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class WinningTicketsReportViewModel @Inject constructor(
    private val businessApi: BusinessApi
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<WinningTicketsResponseDto>>(ResultState.Loading)
    val state: StateFlow<ResultState<WinningTicketsResponseDto>> = _state

    fun load(drawId: String, status: String = "all", code: String? = null) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                ResultState.Success(businessApi.winningTickets(drawId = drawId, status = status, code = code))
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo cargar reporte de ganadores"))
            }
        }
    }
}
