package com.gameover.android.core.domain.util

import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.model.UserRole

object PermissionChecker {
    private val defaultAccess: Map<String, Set<UserRole>> = mapOf(
        "/dashboard" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/users" to setOf(UserRole.admin, UserRole.asociado),
        "/users:create" to setOf(UserRole.admin, UserRole.asociado),
        "/users:update" to setOf(UserRole.admin, UserRole.asociado),
        "/users:status" to setOf(UserRole.admin),
        "/users:password" to setOf(UserRole.admin),
        "/roles" to setOf(UserRole.admin),
        "/roles:update" to setOf(UserRole.admin),
        "/plans" to setOf(UserRole.admin, UserRole.asociado),
        "/plans:create" to setOf(UserRole.admin),
        "/plans:update" to setOf(UserRole.admin),
        "/plans:delete" to setOf(UserRole.admin),
        "/draws" to setOf(UserRole.admin, UserRole.asociado),
        "/draws:create" to setOf(UserRole.admin),
        "/draws:update" to setOf(UserRole.admin),
        "/draws:delete" to setOf(UserRole.admin),
        "/draws:restricted-numbers" to setOf(UserRole.admin),
        "/draws/list" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/multiplicadores" to setOf(UserRole.admin),
        "/sales" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/sales:create" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/sales:cancel" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/ticket-payments" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/reports" to setOf(UserRole.admin, UserRole.asociado),
        "/reports/sales-stats" to setOf(UserRole.admin, UserRole.asociado),
        "/reports/balance-breakdown" to setOf(UserRole.admin, UserRole.asociado),
        "/reports/sales-by-user" to setOf(UserRole.admin, UserRole.asociado),
        "/reports/draw-lists" to setOf(UserRole.admin, UserRole.asociado),
        "/reports/commissions" to setOf(UserRole.admin, UserRole.asociado),
        "/print-queue" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
        "/cash-movements" to setOf(UserRole.admin, UserRole.asociado, UserRole.vendedor),
    )

    fun hasPermission(user: User, resourceKey: String): Boolean {
        return defaultAccess[resourceKey]?.contains(user.role) ?: false
    }
}
