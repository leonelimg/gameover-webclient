package com.gameover.android.core.network.mapper

import com.gameover.android.core.domain.model.*
import com.gameover.android.core.network.dto.*

fun UserDto.toDomain(): User = User(
    id = id,
    fullName = fullName,
    username = username,
    email = email,
    phone = phone,
    role = runCatching { UserRole.valueOf(role) }.getOrDefault(UserRole.vendedor),
    status = runCatching { UserStatus.valueOf(status) }.getOrDefault(UserStatus.activo),
    planId = planId,
    parentId = parentId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun DrawDto.toDomain(): Draw = Draw(
    id = id,
    name = name,
    closeTime = closeTime,
    minutosPreviosCierre = minutosPreviosCierre,
    winnerNumber = winnerNumber,
    status = runCatching { DrawStatus.valueOf(status) }.getOrDefault(DrawStatus.pendiente),
    restrictedNumbers = restrictedNumbers.map { RestrictedNumber(it.number, it.limit) },
    specialMultiplier = specialMultiplier?.let { SpecialMultiplier(it.id, it.name, it.value, "", "") },
    createdAt = createdAt,
)

fun TicketDto.toDomain(): Ticket = Ticket(
    id = id,
    code = code,
    drawId = drawId,
    sellerId = sellerId,
    associateId = associateId,
    customerName = customerName,
    lines = lines.map { TicketLine(it.number, it.amount, it.specialAmount, it.isNicaEspecial) },
    total = total,
    createdAt = createdAt,
    printedAt = printedAt,
    paymentStatus = runCatching { PaymentStatus.valueOf(paymentStatus) }.getOrDefault(PaymentStatus.pendiente),
    paidAt = paidAt,
    canceledAt = canceledAt,
    canceledById = canceledById,
    cancelReason = cancelReason,
    draw = draw?.let {
        DrawSummary(
            id = it.id,
            name = it.name,
            specialMultiplier = it.specialMultiplier?.let { sm ->
                SpecialMultiplierSummary(sm.id, sm.name, sm.value)
            },
        )
    },
    seller = seller?.let {
        UserSummary(
            id = it.id,
            fullName = it.fullName,
            username = it.username,
            planMultiplier = it.plan?.multiplier,
        )
    },
)

fun ReportSummaryDto.toDomain(): ReportSummary = ReportSummary(
    totalSales = totalSales,
    ticketCount = ticketCount,
    drawCount = drawCount,
    userCount = userCount,
    totalPrizes = totalPrizes,
    totalCommissions = totalCommissions,
)

fun TopNumberDto.toDomain(): TopNumber = TopNumber(number, totalAmount, ticketCount)

fun DrawListEntryDto.toDomain(): DrawListEntry = DrawListEntry(number, totalAmount)

fun DrawListResponseDto.toDomain(): List<DrawListEntry> = numbers.map { numberDto ->
    DrawListEntry(
        number = numberDto.number,
        totalAmount = numberDto.total
    )
}
