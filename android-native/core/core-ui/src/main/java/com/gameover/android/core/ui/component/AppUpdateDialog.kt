package com.gameover.android.core.ui.component

import android.content.Intent
import android.net.Uri
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.gameover.android.core.domain.model.AppUpdateInfo

@Composable
fun AppUpdateDialog(
    updateInfo: AppUpdateInfo,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = {
            if (!updateInfo.isMandatory) {
                onDismiss()
            }
        },
        title = { Text("Actualización Disponible (v${updateInfo.versionName})") },
        text = {
            Text(
                updateInfo.releaseNotes ?: "Una nueva versión está disponible para descargar."
            )
        },
        confirmButton = {
            Button(
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(updateInfo.apkUrl))
                    context.startActivity(intent)
                }
            ) {
                Text("Descargar")
            }
        },
        dismissButton = {
            if (!updateInfo.isMandatory) {
                TextButton(onClick = onDismiss) {
                    Text("Omitir por ahora")
                }
            }
        }
    )
}
