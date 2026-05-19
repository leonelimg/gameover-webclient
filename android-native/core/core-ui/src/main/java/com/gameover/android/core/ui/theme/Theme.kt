package com.gameover.android.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = GoRed,
    onPrimary = GoOnPrimary,
    primaryContainer = Color(0xFFFFDAD8),
    secondary = GoGold,
    background = GoBackground,
    surface = GoSurface,
    onBackground = Color(0xFF1C1B1F),
    onSurface = Color(0xFF1C1B1F),
    error = GoDanger,
)

@Composable
fun GameOverTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = GoTypography,
        content = content,
    )
}
