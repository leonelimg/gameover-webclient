package com.gameover.android.core.print

import org.junit.Assert.assertEquals
import org.junit.Test

class PrintRetryPolicyTest {
    @Test
    fun `next delay grows exponentially and is capped`() {
        assertEquals(1_500L, PrintRetryPolicy.nextDelayMs(1))
        assertEquals(3_000L, PrintRetryPolicy.nextDelayMs(2))
        assertEquals(6_000L, PrintRetryPolicy.nextDelayMs(3))
        assertEquals(60_000L, PrintRetryPolicy.nextDelayMs(10))
    }
}
