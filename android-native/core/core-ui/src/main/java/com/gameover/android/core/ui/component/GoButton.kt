package com.gameover.android.core.ui.component

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun GoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    variant: ButtonVariant = ButtonVariant.PRIMARY,
) {
    val isClickable = enabled && !loading

    when (variant) {
        ButtonVariant.PRIMARY -> Button(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
            shape = ButtonDefaults.shape,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    strokeWidth = 2.5.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text(text, style = MaterialTheme.typography.labelLarge)
            }
        }
        ButtonVariant.SECONDARY -> ElevatedButton(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    strokeWidth = 2.5.dp,
                    color = MaterialTheme.colorScheme.primary
                )
            } else {
                Text(text, style = MaterialTheme.typography.labelLarge)
            }
        }
        ButtonVariant.OUTLINED -> OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    strokeWidth = 2.5.dp,
                    color = MaterialTheme.colorScheme.primary
                )
            } else {
                Text(text, style = MaterialTheme.typography.labelLarge)
            }
        }
        ButtonVariant.TEXT -> TextButton(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable
        ) {
            Text(text, style = MaterialTheme.typography.labelLarge)
        }
    }
}

enum class ButtonVariant { PRIMARY, SECONDARY, OUTLINED, TEXT }
