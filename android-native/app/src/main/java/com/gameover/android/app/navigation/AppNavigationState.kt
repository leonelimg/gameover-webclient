package com.gameover.android.app.navigation

import com.gameover.android.core.network.auth.AuthSessionState

class AppNavigationState(
    private val gate: ResourceKeyGate = ResourceKeyGate()
) {
    fun startDestination(session: AuthSessionState): AppDestination {
        if (!session.isAuthenticated) return AppDestination.Login
        val permissions = session.permissions.toSet()
        return if (gate.canAccess(AppDestination.Dashboard, permissions)) {
            AppDestination.Dashboard
        } else {
            AppDestination.Login
        }
    }
}
