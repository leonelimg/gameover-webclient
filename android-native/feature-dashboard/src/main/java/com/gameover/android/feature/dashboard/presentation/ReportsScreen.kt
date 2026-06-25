package com.gameover.android.feature.dashboard.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gameover.android.core.ui.component.GoCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(
    onDrawListReportClick: () -> Unit,
    onDepositsWithdrawalsReportClick: () -> Unit,
    onBalanceBreakdownReportClick: () -> Unit,
    onWinningTicketsReportClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Reportes",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            Text(
                text = "Seleccione un reporte",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    ReportCard(
                        title = "Lista de Sorteos",
                        icon = Icons.Default.Assignment,
                        onClick = onDrawListReportClick
                    )
                }
                item {
                    ReportCard(
                        title = "Depósitos y Retiros",
                        icon = Icons.Default.CompareArrows,
                        onClick = onDepositsWithdrawalsReportClick
                    )
                }
                item {
                    ReportCard(
                        title = "Desglose de Balance",
                        icon = Icons.Default.TrendingUp,
                        onClick = onBalanceBreakdownReportClick
                    )
                }
                item {
                    ReportCard(
                        title = "Pago de Tickets",
                        icon = Icons.Default.Star,
                        onClick = onWinningTicketsReportClick
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportCard(
    title: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    GoCard(
        onClick = onClick,
        modifier = Modifier.height(140.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )
        }
    }
}
