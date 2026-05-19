package com.gameover.android.core.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun NoConnectionBanner(isVisible: Boolean, onRetry: (() -> Unit)? = null) {
    AnimatedVisibility(visible = isVisible) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF37474F))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.CloudOff, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Text("Sin conexión a internet", color = Color.White, fontSize = 13.sp)
            }
            if (onRetry != null) {
                TextButton(onClick = onRetry) {
                    Text("Reintentar", color = Color(0xFFFFD54F), fontSize = 12.sp)
                }
            }
        }
    }
}
