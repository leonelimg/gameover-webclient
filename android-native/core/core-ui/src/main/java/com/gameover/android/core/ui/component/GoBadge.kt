package com.gameover.android.core.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gameover.android.core.ui.theme.*

enum class BadgeVariant { SUCCESS, WARNING, DANGER, INFO, NEUTRAL }

@Composable
fun GoBadge(text: String, variant: BadgeVariant = BadgeVariant.NEUTRAL, modifier: Modifier = Modifier) {
    val (bg, fg) = when (variant) {
        BadgeVariant.SUCCESS -> Pair(Color(0xFFE8F5E9), GoSuccess)
        BadgeVariant.WARNING -> Pair(Color(0xFFFFF3E0), GoWarning)
        BadgeVariant.DANGER -> Pair(Color(0xFFFFEBEE), GoDanger)
        BadgeVariant.INFO -> Pair(Color(0xFFE3F2FD), Color(0xFF1565C0))
        BadgeVariant.NEUTRAL -> Pair(Color(0xFFF5F5F5), GoNeutral)
    }
    Text(
        text = text,
        color = fg,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

// Draw status badge helper
@Composable
fun DrawStatusBadge(status: String, modifier: Modifier = Modifier) {
    val (label, variant) = when (status) {
        "abierto" -> Pair("Abierto", BadgeVariant.SUCCESS)
        "cerrado" -> Pair("Cerrado", BadgeVariant.WARNING)
        "finalizado" -> Pair("Finalizado", BadgeVariant.NEUTRAL)
        else -> Pair("Pendiente", BadgeVariant.INFO)
    }
    GoBadge(text = label, variant = variant, modifier = modifier)
}

// Ticket payment status badge
@Composable
fun PaymentStatusBadge(status: String, isCanceled: Boolean, modifier: Modifier = Modifier) {
    if (isCanceled) {
        GoBadge("Anulado", BadgeVariant.DANGER, modifier)
    } else when (status) {
        "pagado" -> GoBadge("Pagado", BadgeVariant.SUCCESS, modifier)
        else -> GoBadge("Pendiente", BadgeVariant.NEUTRAL, modifier)
    }
}
