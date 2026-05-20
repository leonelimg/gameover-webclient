package com.gameover.android.feature.auth.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.ui.component.GoButton
import com.gameover.android.core.ui.component.GoTextField
import com.gameover.android.core.ui.theme.GoRed
import com.gameover.android.core.ui.theme.GoRedDark

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val username by viewModel.username.collectAsState()
    val password by viewModel.password.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val focusManager = LocalFocusManager.current
    val isDarkTheme = isSystemInDarkTheme()

    var passwordVisible by remember { mutableStateOf(false) }

    val backgroundGradient = if (isDarkTheme) {
        listOf(
            Color(0xFF05070B),
            Color(0xFF182030),
        )
    } else {
        listOf(
            GoRedDark.copy(alpha = 0.95f),
            GoRed.copy(alpha = 0.85f),
        )
    }

    val loginFieldColors = if (isDarkTheme) {
        OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
            disabledBorderColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f),
            focusedLabelColor = MaterialTheme.colorScheme.primary,
        )
    } else {
        OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f),
        )
    }

    LaunchedEffect(uiState) {
        when (uiState) {
            is LoginUiState.Success -> onLoginSuccess()
            is LoginUiState.Error -> {
                snackbarHostState.showSnackbar((uiState as LoginUiState.Error).message)
                viewModel.clearError()
            }
            else -> {}
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        backgroundGradient
                    )
                )
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .padding(horizontal = 12.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 12.dp),
                shape = MaterialTheme.shapes.large,
                border = if (isDarkTheme) {
                    BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.55f))
                } else {
                    null
                },
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    // Logo / Title with better hierarchy
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "GameOver",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = GoRed,
                    )
                    Text(
                        text = "Sistema de Gestión de Lotería",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Username field with better styling
                    GoTextField(
                        value = username,
                        onValueChange = viewModel::onUsernameChange,
                        label = "Usuario",
                        placeholder = "",
                        enabled = uiState !is LoginUiState.Loading,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Next,
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) },
                        ),
                        colors = loginFieldColors,
                    )

                    // Password field with better styling
                    GoTextField(
                        value = password,
                        onValueChange = viewModel::onPasswordChange,
                        label = "Contraseña",
                        placeholder = "",
                        enabled = uiState !is LoginUiState.Loading,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.login()
                            },
                        ),
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (passwordVisible) "Ocultar contraseña" else "Mostrar contraseña",
                                    tint = if (passwordVisible) GoRed else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        colors = loginFieldColors,
                    )

                    // Login button with better prominence
                    GoButton(
                        text = if (uiState is LoginUiState.Loading) "Iniciando sesión..." else "Iniciar Sesión",
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.login()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        loading = uiState is LoginUiState.Loading,
                        enabled = uiState !is LoginUiState.Loading && username.isNotBlank() && password.isNotBlank(),
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
        }
    }
}
