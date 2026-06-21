package com.gameover.android.feature.bluetooth.escpos

import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

object TicketImageGenerator {

    private const val BITMAP_WIDTH = 500
    private const val PADDING = 30
    private const val LINE_SPACING = 4
    private const val FONT_SIZE = 22f

    fun shareTicketAsImage(context: Context, lines: List<TicketFormatter.TicketTextLine>) {
        val bitmap = generateBitmap(lines)
        val file = saveBitmapToFile(context, bitmap)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "Ticket de PM Tickets")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            setPackage("com.whatsapp")
        }
        
        // If WhatsApp is not installed, show chooser
        val chooser = Intent.createChooser(intent, "Compartir Ticket")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    private fun generateBitmap(lines: List<TicketFormatter.TicketTextLine>): Bitmap {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = FONT_SIZE
            typeface = Typeface.MONOSPACE
        }

        val boldPaint = Paint(paint).apply {
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }

        val doublePaint = Paint(paint).apply {
            textSize = FONT_SIZE * 2
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }

        // Calculate height
        var totalHeight = PADDING * 2
        for (line in lines) {
            val p = if (line.isDoubleSize) doublePaint else if (line.isBold) boldPaint else paint
            if (line.text == "---DIVIDER---") {
                totalHeight += (FONT_SIZE / 2).toInt() + LINE_SPACING
            } else {
                totalHeight += p.fontMetricsInt.run { bottom - top } + LINE_SPACING
            }
        }
        totalHeight += 40 // bottom padding

        val bitmap = Bitmap.createBitmap(BITMAP_WIDTH, totalHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        var currentY = PADDING.toFloat()
        for (line in lines) {
            val p = if (line.isDoubleSize) doublePaint else if (line.isBold) boldPaint else paint
            val textHeight = p.fontMetricsInt.run { bottom - top }.toFloat()

            if (line.text == "---DIVIDER---") {
                val y = currentY + textHeight / 4
                canvas.drawLine(PADDING.toFloat(), y, (BITMAP_WIDTH - PADDING).toFloat(), y, paint)
                currentY += textHeight / 2 + LINE_SPACING
                continue
            }

            val textWidth = p.measureText(line.text)
            val x = when (line.alignment) {
                TicketFormatter.TicketAlignment.LEFT -> PADDING.toFloat()
                TicketFormatter.TicketAlignment.CENTER -> (BITMAP_WIDTH - textWidth) / 2
                TicketFormatter.TicketAlignment.RIGHT -> BITMAP_WIDTH - PADDING - textWidth
            }

            canvas.drawText(line.text, x, currentY - p.fontMetricsInt.top, p)
            currentY += textHeight + LINE_SPACING
        }

        return bitmap
    }

    private fun saveBitmapToFile(context: Context, bitmap: Bitmap): File {
        val cachePath = File(context.cacheDir, "images")
        cachePath.mkdirs()
        val file = File(cachePath, "ticket_${System.currentTimeMillis()}.png")
        val stream = FileOutputStream(file)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        stream.close()
        return file
    }
}
