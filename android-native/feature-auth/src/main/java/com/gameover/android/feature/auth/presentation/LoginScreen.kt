package com.gameover.android.feature.auth.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.ui.R
import com.gameover.android.core.ui.component.GoButton
import com.gameover.android.core.ui.component.GoTextField
import com.gameover.android.core.ui.theme.GoBlue
import com.gameover.android.core.ui.theme.GoBlueDark

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

    val loginFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = MaterialTheme.colorScheme.primary,
        unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
        focusedContainerColor = Color.Transparent,
        unfocusedContainerColor = Color.Transparent,
    )

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
                .background(Color(0xFF1D293D))
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .imePadding(),
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
                    modifier = Modifier.padding(horizontal = 32.dp, vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Logo / Title with better hierarchy
                    Image(
                        painter = painterResource(id = R.drawable.pmcomercial),
                        contentDescription = "Logo P&M Comercial",
                        modifier = Modifier
                            .size(100.dp)
                            .padding(bottom = 8.dp)
                    )
                    Text(
                        text = "Sistema de Venta de Tickets",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(4.dp))/*Text(
                        text = "PM Comercial",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = GoBlue,
                        modifier = Modifier.padding(top = 8.dp)
                    )*/


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
                                    tint = if (passwordVisible) GoBlue else MaterialTheme.colorScheme.onSurfaceVariant
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
