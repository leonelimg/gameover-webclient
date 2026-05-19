package com.gameover.android.core.ui.component

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
    when (variant) {
        ButtonVariant.PRIMARY -> Button(
            onClick = onClick,
            modifier = modifier.height(48.dp),
            enabled = enabled && !loading,
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            else Text(text)
        }
        ButtonVariant.OUTLINED -> OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(48.dp),
            enabled = enabled && !loading,
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
            else Text(text)
        }
        ButtonVariant.TEXT -> TextButton(onClick = onClick, modifier = modifier, enabled = enabled && !loading) {
            Text(text)
        }
    }
}

enum class ButtonVariant { PRIMARY, OUTLINED, TEXT }
