package com.gameover.android.core.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gameover.android.core.ui.theme.GoDanger

@Composable
fun ErrorBanner(message: String?, modifier: Modifier = Modifier) {
    AnimatedVisibility(visible = !message.isNullOrBlank()) {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .background(androidx.compose.ui.graphics.Color(0xFFFFEBEE))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = GoDanger, modifier = Modifier.size(18.dp))
            Text(text = message ?: "", color = GoDanger, fontSize = 13.sp)
        }
    }
}
