package com.gameover.android.feature.bluetooth.escpos

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/**
 * Pure Kotlin ESC/POS command builder for generic thermal printers.
 * No SDK dependencies — produces raw byte arrays.
 */
class EscPosBuilder {

    private val buffer = ByteArrayOutputStream()
    private val charset = Charset.forName("cp437") // Common for thermal printers

    companion object {
        // ESC/POS Commands
        val INIT = byteArrayOf(0x1B, 0x40) // Initialize printer
        val LF = byteArrayOf(0x0A) // Line feed
        val CR = byteArrayOf(0x0D) // Carriage return

        // Text alignment
        val ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
        val ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
        val ALIGN_RIGHT = byteArrayOf(0x1B, 0x61, 0x02)

        // Font styles
        val BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
        val BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)
        val UNDERLINE_ON = byteArrayOf(0x1B, 0x2D, 0x01)
        val UNDERLINE_OFF = byteArrayOf(0x1B, 0x2D, 0x00)

        // Double height/width text
        val DOUBLE_HEIGHT_ON = byteArrayOf(0x1B, 0x21, 0x10)
        val NORMAL_SIZE = byteArrayOf(0x1B, 0x21, 0x00)

        // Cut paper
        val PARTIAL_CUT = byteArrayOf(0x1D, 0x56, 0x01)
        val FULL_CUT = byteArrayOf(0x1D, 0x56, 0x00)

        // QR Code commands (GS ( k)
        fun qrCode(data: String): ByteArray {
            val store = ByteArrayOutputStream()
            val encodedData = data.toByteArray(Charsets.UTF_8)
            val dataLen = encodedData.size + 3

            // Set QR code model
            store.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00))
            // Set QR code size (module size = 4)
            store.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04))
            // Set error correction level (L)
            store.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30))
            // Store QR data
            store.write(byteArrayOf(
                0x1D, 0x28, 0x6B,
                (dataLen and 0xFF).toByte(),
                ((dataLen shr 8) and 0xFF).toByte(),
                0x31, 0x50, 0x30,
            ))
            store.write(encodedData)
            // Print QR
            store.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30))
            return store.toByteArray()
        }
    }

    fun init(): EscPosBuilder { buffer.write(INIT); return this }
    fun lineFeed(count: Int = 1): EscPosBuilder {
        repeat(count) { buffer.write(LF) }
        return this
    }
    fun alignLeft(): EscPosBuilder { buffer.write(ALIGN_LEFT); return this }
    fun alignCenter(): EscPosBuilder { buffer.write(ALIGN_CENTER); return this }
    fun alignRight(): EscPosBuilder { buffer.write(ALIGN_RIGHT); return this }
    fun boldOn(): EscPosBuilder { buffer.write(BOLD_ON); return this }
    fun boldOff(): EscPosBuilder { buffer.write(BOLD_OFF); return this }
    fun doubleSizeOn(): EscPosBuilder { buffer.write(DOUBLE_HEIGHT_ON); return this }
    fun normalSize(): EscPosBuilder { buffer.write(NORMAL_SIZE); return this }
    fun partialCut(): EscPosBuilder { buffer.write(PARTIAL_CUT); return this }

    fun text(text: String): EscPosBuilder {
        buffer.write(text.toByteArray(charset))
        return this
    }
    fun textLn(text: String): EscPosBuilder = text(text).lineFeed()
    fun divider(char: Char = '-', width: Int = 32): EscPosBuilder = textLn(char.toString().repeat(width))

    /** Two-column row: left text and right text, padded to `width` total chars */
    fun twoColumnRow(left: String, right: String, width: Int = 32): EscPosBuilder {
        val padding = width - left.length - right.length
        val line = if (padding > 0) left + " ".repeat(padding) + right
                   else left.take(width - right.length - 1) + " " + right
        return textLn(line)
    }

    fun qrCode(data: String): EscPosBuilder {
        buffer.write(EscPosBuilder.qrCode(data))
        return this
    }

    fun build(): ByteArray = buffer.toByteArray()
}
