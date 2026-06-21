package com.gameover.android.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.repository.AnnouncementRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AnnouncementsViewModel @Inject constructor(
    private val announcementRepository: AnnouncementRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnnouncementsUiState())
    val uiState: StateFlow<AnnouncementsUiState> = _uiState.asStateFlow()

    init {
        loadAnnouncements()
    }

    fun loadAnnouncements() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val announcements = announcementRepository.getActiveAnnouncements()
                _uiState.update { it.copy(isLoading = false, announcements = announcements) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Error al cargar anuncios") }
            }
        }
    }

    fun dismissAnnouncement(id: Int) {
        viewModelScope.launch {
            try {
                announcementRepository.dismissAnnouncement(id)
                _uiState.update { state ->
                    state.copy(announcements = state.announcements.filter { it.id != id })
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Error al descartar anuncio") }
            }
        }
    }
}
