package com.gameover.android.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = GoRed,
    onPrimary = GoOnPrimary,
    primaryContainer = GoRedContainer,
    secondary = GoGold,
    onSecondary = GoOnSecondary,
    secondaryContainer = GoGoldContainer,
    tertiary = GoBlue,
    tertiaryContainer = GoBlueContainer,
    background = GoBackground,
    onBackground = GoText,
    surface = GoSurface,
    onSurface = GoText,
    surfaceVariant = Color(0xFFEDEDED),
    onSurfaceVariant = GoTextSecondary,
    outline = GoDivider,
    error = GoDanger,
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
)

private val DarkColorScheme = darkColorScheme(
    primary = GoRedLight,
    onPrimary = GoText,
    primaryContainer = GoRedDark,
    secondary = GoGoldLight,
    onSecondary = GoText,
    secondaryContainer = GoGoldDark,
    tertiary = GoBlueLight,
    tertiaryContainer = GoBlueDark,
    background = GoDarkBackground,
    onBackground = Color.White,
    surface = GoDarkSurface,
    onSurface = Color.White,
    surfaceVariant = Color(0xFF3F3F3F),
    onSurfaceVariant = Color(0xFFCCCCCC),
    outline = GoDividerDark,
    error = GoDangerLight,
    onError = GoText,
    errorContainer = Color(0xFF3E0000),
)

@Composable
fun GameOverTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = GoTypography,
        content = content,
    )
}
