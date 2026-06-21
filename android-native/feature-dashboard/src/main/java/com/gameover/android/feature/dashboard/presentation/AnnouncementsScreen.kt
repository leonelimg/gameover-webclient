package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.gameover.android.core.domain.model.Announcement
import com.gameover.android.core.ui.component.ErrorBanner
import com.gameover.android.core.ui.theme.GoNeutral

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnnouncementsScreen(
    onBack: () -> Unit,
    viewModel: AnnouncementsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Anuncios") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Atrás")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (uiState.isLoading && uiState.announcements.isEmpty()) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (uiState.announcements.isEmpty() && uiState.error == null) {
                Text(
                    "No hay anuncios activos",
                    modifier = Modifier.align(Alignment.Center),
                    color = GoNeutral
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (uiState.error != null) {
                        item { ErrorBanner(message = uiState.error!!) }
                    }
                    items(uiState.announcements, key = { it.id }) { announcement ->
                        AnnouncementItem(
                            announcement = announcement,
                            onDismiss = { viewModel.dismissAnnouncement(it) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AnnouncementItem(
    announcement: Announcement,
    onDismiss: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = announcement.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                if (announcement.dismissable) {
                    IconButton(
                        onClick = { onDismiss(announcement.id) },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Descartar",
                            tint = GoNeutral
                        )
                    }
                }
            }

            if (!announcement.message.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = announcement.message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (!announcement.image.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(12.dp))
                AsyncImage(
                    model = announcement.image,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp),
                    contentScale = ContentScale.Fit
                )
            }
        }
    }
}
