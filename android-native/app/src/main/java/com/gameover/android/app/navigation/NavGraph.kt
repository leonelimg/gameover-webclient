package com.gameover.android.app.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.gameover.android.app.session.SessionManager
import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.util.PermissionChecker
import com.gameover.android.feature.auth.presentation.LoginScreen
import com.gameover.android.feature.dashboard.presentation.DashboardScreen
import com.gameover.android.feature.dashboard.presentation.AnnouncementsScreen
import com.gameover.android.feature.dashboard.presentation.ReportsScreen
import com.gameover.android.feature.dashboard.presentation.DrawListReportScreen
import com.gameover.android.feature.sales.presentation.SalesScreen
import com.gameover.android.feature.settings.presentation.SettingsScreen
import com.gameover.android.feature.tickets.presentation.TicketDetailScreen
import com.gameover.android.feature.tickets.presentation.TicketsScreen
import kotlinx.coroutines.flow.first

object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val SALES = "sales"
    const val TICKETS = "tickets"
    const val REPORTS = "reports"
    const val DRAW_LIST_REPORT = "reports/draw-list"
    const val TICKET_DETAIL = "ticket/{ticketId}"
    const val SETTINGS = "settings"
    const val ANNOUNCEMENTS = "announcements"

    fun ticketDetail(ticketId: String) = "ticket/$ticketId"
}

data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
    val requiredPermission: String? = null,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNavGraph(
    sessionManager: SessionManager,
    authRepository: AuthRepository,
) {
    val navController = rememberNavController()
    val isAuthenticated by sessionManager.isAuthenticated.collectAsState(initial = null)
    var currentUser by remember { mutableStateOf<User?>(null) }

    if (isAuthenticated == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    // Watch session: navigate to login when session is cleared
    LaunchedEffect(isAuthenticated) {
        when (isAuthenticated) {
            true -> {
                currentUser = authRepository.getStoredUser().first()
                if (navController.currentDestination?.route == Routes.LOGIN || navController.currentDestination?.route == null) {
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            }
            false -> {
                navController.navigate(Routes.LOGIN) {
                    popUpTo(0) { inclusive = true }
                }
            }
            null -> {} // Still loading
        }
    }

    val bottomNavItems = listOf(
        BottomNavItem(Routes.DASHBOARD, "Dashboard", Icons.Default.Dashboard, Icons.Default.Dashboard),
        BottomNavItem(Routes.SALES, "Ventas", Icons.Default.ShoppingCart, Icons.Default.ShoppingCart),
        BottomNavItem(Routes.TICKETS, "Tickets", Icons.Default.List, Icons.Default.List),
        BottomNavItem(Routes.REPORTS, "Reportes", Icons.Default.BarChart, Icons.Default.BarChart),
        BottomNavItem(Routes.SETTINGS, "Config", Icons.Default.Settings, Icons.Default.Settings),
    )

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute != Routes.LOGIN && isAuthenticated == true

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    modifier = Modifier,
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 8.dp,
                ) {
                    val user = currentUser
                    bottomNavItems.forEach { item ->
                        val hasAccess = item.requiredPermission == null ||
                            user?.let { PermissionChecker.hasPermission(it, item.requiredPermission) } == true
                        if (hasAccess) {
                            val isSelected = navBackStackEntry?.destination?.hierarchy?.any { it.route == item.route } == true
                            NavigationBarItem(
                                selected = isSelected,
                                onClick = {
                                    navController.navigate(item.route) {
                                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = {
                                    Icon(
                                        if (isSelected) item.selectedIcon else item.icon,
                                        contentDescription = item.label
                                    )
                                },
                                label = { Text(item.label, style = MaterialTheme.typography.labelSmall) },
                                alwaysShowLabel = true,
                            )
                        }
                    }
                }
            }
        },
        contentWindowInsets = WindowInsets(0, 0, 0, 0)
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = if (isAuthenticated == true) Routes.DASHBOARD else Routes.LOGIN,
            modifier = Modifier.padding(paddingValues),
            enterTransition = { fadeIn(animationSpec = tween(300)) },
            exitTransition = { fadeOut(animationSpec = tween(300)) },
        ) {
            composable(Routes.LOGIN) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Routes.DASHBOARD) {
                            popUpTo(Routes.LOGIN) { inclusive = true }
                        }
                    },
                )
            }

            composable(Routes.DASHBOARD) {
                DashboardScreen(
                    onNotificationsClick = {
                        navController.navigate(Routes.ANNOUNCEMENTS)
                    }
                )
            }

            composable(Routes.ANNOUNCEMENTS) {
                AnnouncementsScreen(onBack = { navController.popBackStack() })
            }

            composable(Routes.SALES) {
                SalesScreen()
            }

            composable(Routes.TICKETS) {
                TicketsScreen(
                    onTicketClick = { ticketId ->
                        navController.navigate(Routes.ticketDetail(ticketId))
                    },
                    onScanClick = {
                        // Camera scan: for now navigate to a scan result route
                        // Could be enhanced with CameraX in TicketsScreen itself
                    },
                )
            }

            composable(Routes.REPORTS) {
                ReportsScreen(
                    onReportClick = {
                        navController.navigate(Routes.DRAW_LIST_REPORT)
                    }
                )
            }

            composable(Routes.DRAW_LIST_REPORT) {
                DrawListReportScreen(onBack = { navController.popBackStack() })
            }

            composable(
                route = Routes.TICKET_DETAIL,
                arguments = listOf(navArgument("ticketId") { type = NavType.StringType }),
            ) {
                TicketDetailScreen(onBack = { navController.popBackStack() })
            }

            composable(Routes.SETTINGS) {
                SettingsScreen()
            }
        }
    }
}
