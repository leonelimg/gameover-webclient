package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.util.CurrencyFormatter
import com.gameover.android.core.ui.component.ErrorBanner
import com.gameover.android.core.ui.theme.GoBlue
import com.gameover.android.core.ui.theme.GoNeutral

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DrawListReportScreen(
    onBack: () -> Unit,
    viewModel: DrawListReportViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Lista de Sorteo",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            RangeSelector(
                selected = uiState.selectedRange,
                onSelect = viewModel::onRangeSelected,
                modifier = Modifier.padding(16.dp)
            )

            if (uiState.error != null) {
                ErrorBanner(message = uiState.error!!, modifier = Modifier.padding(horizontal = 16.dp))
            }

            DrawSelector(
                draws = uiState.draws,
                selectedDrawId = uiState.selectedDrawId,
                onDrawSelected = viewModel::onDrawSelected,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (uiState.reportEntries.isNotEmpty()) {
                ReportTable(entries = uiState.reportEntries)
            } else if (uiState.selectedDrawId != null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No hay datos para este sorteo", color = GoNeutral)
                }
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Seleccione un sorteo para ver el reporte", color = GoNeutral)
                }
            }
        }
    }
}

@Composable
private fun RangeSelector(
    selected: DashboardRange,
    onSelect: (DashboardRange) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val ranges = listOf(
            DashboardRange.TODAY to "Hoy",
            DashboardRange.WEEK to "Semana",
            DashboardRange.MONTH to "Mes"
        )
        ranges.forEach { (range, label) ->
            FilterChip(
                selected = selected == range,
                onClick = { onSelect(range) },
                label = { Text(label) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DrawSelector(
    draws: List<Draw>,
    selectedDrawId: String?,
    onDrawSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedDraw = draws.find { it.id == selectedDrawId }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selectedDraw?.name ?: "Seleccione un sorteo",
            onValueChange = {},
            readOnly = true,
            label = { Text("Sorteo") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            draws.forEach { draw ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(draw.name, fontWeight = FontWeight.Bold)
                            Text(
                                text = "${draw.status} - ${draw.closeTime.take(16).replace('T', ' ')}",
                                style = MaterialTheme.typography.bodySmall,
                                color = GoNeutral
                            )
                        }
                    },
                    onClick = {
                        onDrawSelected(draw.id)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun ReportTable(entries: List<com.gameover.android.core.domain.model.DrawListEntry>) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Text(
                text = "Número",
                modifier = Modifier.weight(1f),
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
            Text(
                text = "Monto",
                modifier = Modifier.weight(1f),
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                textAlign = TextAlign.End
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 16.dp)
        ) {
            items(entries) { entry ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Text(
                        text = entry.number,
                        modifier = Modifier.weight(1f),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = CurrencyFormatter.format(entry.totalAmount),
                        modifier = Modifier.weight(1f),
                        fontSize = 16.sp,
                        textAlign = TextAlign.End,
                        color = GoBlue,
                        fontWeight = FontWeight.Bold
                    )
                }
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), thickness = 0.5.dp, color = Color.LightGray)
            }
            
            item {
                val total = entries.sumOf { it.totalAmount }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "TOTAL",
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp
                    )
                    Text(
                        text = CurrencyFormatter.format(total),
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.End,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}
