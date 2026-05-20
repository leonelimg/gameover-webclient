package com.gameover.android.core.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gameover.android.core.ui.theme.GoWarning

@Composable
fun NoConnectionBanner(isVisible: Boolean, onRetry: (() -> Unit)? = null) {
    AnimatedVisibility(
        visible = isVisible,
        enter = slideInVertically(initialOffsetY = { -it }),
        exit = slideOutVertically(targetOffsetY = { -it })
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = GoWarning.copy(alpha = 0.95f),
                    shape = MaterialTheme.shapes.small
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    Icons.Default.WifiOff,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    "Sin conexión a internet",
                    color = Color.White,
                    fontSize = 13.sp,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            if (onRetry != null) {
                TextButton(onClick = onRetry) {
                    Text(
                        "Reintentar",
                        color = Color.White,
                        fontSize = 12.sp,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}
