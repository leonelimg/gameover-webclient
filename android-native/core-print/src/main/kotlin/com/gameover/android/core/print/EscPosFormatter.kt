package com.gameover.android.core.print

object EscPosFormatter {
    private const val ESC: Byte = 0x1B
    private const val GS: Byte = 0x1D

    fun build(ticket: EscPosTicket): ByteArray {
        val out = ArrayList<Byte>()
        fun write(vararg bytes: Byte) = out.addAll(bytes.asList())
        fun line(text: String = "") {
            out.addAll(text.toByteArray(Charsets.US_ASCII).toList())
            out.add('\n'.code.toByte())
        }

        write(ESC, 0x40)
        write(ESC, 0x61, 0x01)
        write(ESC, 0x45, 0x01)
        line(ticket.title)
        write(ESC, 0x45, 0x00)
        line(ticket.businessName)
        line("-------------------------------")

        write(ESC, 0x61, 0x00)
        line("Ticket: ${ticket.ticketNumber}")
        line("Fecha: ${ticket.dateIso}")
        line("Cajero: ${ticket.cashier}")
        line("Sorteo: ${ticket.drawName}")
        line("-------------------------------")
        line("NUM   REGULAR   ESPECIAL   TOTAL")
        ticket.detailLines.forEach {
            line("${it.number.padEnd(4)} ${money(it.regular).padStart(8)} ${money(it.special).padStart(9)} ${money(it.total).padStart(8)}")
        }
        line("-------------------------------")
        line("TOTAL: C$ ${money(ticket.total)}")

        ticket.notes.forEach(::line)
        ticket.qrText?.let { qr ->
            line("-------------------------------")
            write(ESC, 0x61, 0x01)
            line("Verificar ticket")
            line(qr)
        }

        write(ESC, 0x64, 0x03)
        write(GS, 0x56, 0x41, 0x00)

        return out.toByteArray()
    }

    private fun money(value: Double): String = "%.2f".format(value)
}
