package com.gameover.android.app.navigation

class ResourceKeyGate {
    fun canAccess(destination: AppDestination, permissions: Set<String>): Boolean {
        val key = destination.resourceKey ?: return true
        return permissions.contains(key)
    }

    fun filterAllowed(
        destinations: List<AppDestination>,
        permissions: Set<String>
    ): List<AppDestination> = destinations.filter { canAccess(it, permissions) }
}
