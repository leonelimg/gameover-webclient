package com.gameover.android.core.ui.component

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

@Composable
fun GoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    variant: ButtonVariant = ButtonVariant.PRIMARY,
    trailingIcon: ImageVector? = null,
    containerColor: Color? = null,
    contentColor: Color? = null,
) {
    val isClickable = enabled && !loading

    val colors = when (variant) {
        ButtonVariant.PRIMARY -> ButtonDefaults.buttonColors(
            containerColor = containerColor ?: MaterialTheme.colorScheme.primary,
            contentColor = contentColor ?: MaterialTheme.colorScheme.onPrimary
        )
        ButtonVariant.SECONDARY -> ButtonDefaults.elevatedButtonColors(
            containerColor = containerColor ?: MaterialTheme.colorScheme.secondaryContainer,
            contentColor = contentColor ?: MaterialTheme.colorScheme.onSecondaryContainer
        )
        ButtonVariant.OUTLINED -> ButtonDefaults.outlinedButtonColors(
            containerColor = containerColor ?: Color.Transparent,
            contentColor = contentColor ?: MaterialTheme.colorScheme.primary
        )
        ButtonVariant.TEXT -> ButtonDefaults.textButtonColors(
            containerColor = containerColor ?: Color.Transparent,
            contentColor = contentColor ?: MaterialTheme.colorScheme.primary
        )
    }

    val content = @Composable {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.5.dp,
                    color = colors.contentColor
                )
            } else {
                Text(text, style = MaterialTheme.typography.labelLarge)
                if (trailingIcon != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        imageVector = trailingIcon,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }

    when (variant) {
        ButtonVariant.PRIMARY -> Button(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
            shape = ButtonDefaults.shape,
            colors = colors,
            content = { content() }
        )
        ButtonVariant.SECONDARY -> ElevatedButton(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
            colors = colors,
            content = { content() }
        )
        ButtonVariant.OUTLINED -> OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
            colors = colors,
            content = { content() }
        )
        ButtonVariant.TEXT -> TextButton(
            onClick = onClick,
            modifier = modifier.height(50.dp),
            enabled = isClickable,
            colors = colors,
            content = { content() }
        )
    }
}

enum class ButtonVariant { PRIMARY, SECONDARY, OUTLINED, TEXT }
