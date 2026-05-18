package com.gameover.android.feature.tickets

interface TicketCodeScanner {
    suspend fun scanCode(): String
}

/**
 * Contrato para flujo por cámara requerido por alcance.
 * La implementación concreta puede integrarse con CameraX + MLKit o ZXing.
 */
