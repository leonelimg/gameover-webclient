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
            username = it.username.orEmpty(),
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

fun CashMovementBalanceResponseDto.toDomain(): CashMovementBalance = CashMovementBalance(
    totals = totals.toDomain()
)

fun CashMovementBalanceTotalsDto.toDomain(): CashMovementBalanceTotals = CashMovementBalanceTotals(
    openingBalance = openingBalance,
    totalDeposits = totalDeposits,
    totalWithdrawals = totalWithdrawals,
    totalSales = totalSales,
    totalPrizes = totalPrizes,
    ticketCount = ticketCount,
    balance = balance
)

fun CashMovementTargetDto.toDomain(): CashMovementTarget = CashMovementTarget(
    id = id,
    fullName = fullName,
    username = username,
    role = role,
    status = status,
    canOperate = canOperate
)

fun CashMovementActorDto.toDomain(): CashMovementActor = CashMovementActor(
    id = id,
    fullName = fullName,
    username = username,
    role = role
)

fun CashMovementHistoryItemDto.toDomain(): CashMovementHistoryItem = CashMovementHistoryItem(
    id = id,
    targetUserId = targetUserId,
    createdById = createdById,
    type = type,
    amount = amount,
    note = note,
    createdAt = createdAt,
    canceledAt = canceledAt,
    canceledById = canceledById,
    createdBy = createdBy.toDomain(),
    targetUser = targetUser.toDomain(),
    source = source,
    referenceCode = referenceCode,
    balanceAfterTransaction = balanceAfterTransaction
)

fun CashMovementEventSummaryTotalsDto.toDomain(): CashMovementEventSummaryTotals = CashMovementEventSummaryTotals(
    openingBalance = openingBalance,
    ticketCount = ticketCount,
    totalSales = totalSales,
    totalPrizes = totalPrizes,
    totalCommissions = totalCommissions,
    balance = balance
)

fun CashMovementEventSummaryRowDto.toDomain(): CashMovementEventSummaryRow = CashMovementEventSummaryRow(
    eventId = eventId,
    eventName = eventName,
    eventDate = eventDate,
    ticketCount = ticketCount,
    totalSales = totalSales,
    totalPrizes = totalPrizes,
    totalCommissions = totalCommissions,
    balance = balance,
    balanceAfterTransaction = balanceAfterTransaction
)

fun CashMovementEventSummaryResponseDto.toDomain(): CashMovementEventSummaryResponse = CashMovementEventSummaryResponse(
    targetUser = targetUser.toDomain(),
    totals = totals.toDomain(),
    rows = rows.map { it.toDomain() }
)

fun BalanceBreakdownTotalsDto.toDomain(): BalanceBreakdownTotals = BalanceBreakdownTotals(
    ticketCount = ticketCount,
    totalSales = totalSales,
    totalPrizes = totalPrizes,
    totalCommissions = totalCommissions,
    balance = balance
)

fun AssociateDrawBreakdownRowDto.toDomain(): AssociateDrawBreakdownRow = AssociateDrawBreakdownRow(
    drawId = drawId,
    drawName = drawName,
    drawCloseTime = drawCloseTime,
    lastTicketCreatedAt = lastTicketCreatedAt,
    ticketCount = ticketCount,
    totalSales = totalSales,
    totalPrizes = totalPrizes,
    totalCommissions = totalCommissions,
    balance = balance
)

fun AssociateBreakdownRowDto.toDomain(): AssociateBreakdownRow = AssociateBreakdownRow(
    associateId = associateId,
    associateName = associateName,
    parentId = parentId,
    ticketCount = ticketCount,
    totalSales = totalSales,
    totalPrizes = totalPrizes,
    totalCommissions = totalCommissions,
    balance = balance,
    draws = draws.map { it.toDomain() }
)

fun BalanceBreakdownResponseDto.toDomain(): BalanceBreakdownResponse = BalanceBreakdownResponse(
    totals = byAssociate.totals.toDomain(),
    rows = byAssociate.rows.map { it.toDomain() }
)

fun WinningTicketsResponseDto.toDomain(): WinningTicketsReport = WinningTicketsReport(
    draw = draw.toDomain(),
    tickets = tickets.map { it.toDomain() },
    paidTickets = paidTickets.map { it.toDomain() },
    totals = totals.toDomain()
)

fun WinningTicketsDrawDto.toDomain(): WinningTicketsDraw = WinningTicketsDraw(
    id = id,
    name = name,
    winnerNumber = winnerNumber,
    hasWinnerNumber = hasWinnerNumber
)

fun WinningTicketDto.toDomain(): WinningTicket = WinningTicket(
    ticketId = ticketId,
    code = code,
    customerName = customerName,
    seller = seller.toDomain(),
    createdAt = createdAt,
    paymentStatus = paymentStatus,
    paidAt = paidAt,
    paidBy = paidBy?.toDomain(),
    winningNumbers = winningNumbers,
    prizeAmount = prizeAmount
)

fun WinningTicketSellerDto.toDomain(): WinningTicketSeller = WinningTicketSeller(
    id = id,
    fullName = fullName,
    username = username,
    plan = plan?.toDomain()
)

fun WinningTicketPlanDto.toDomain(): WinningTicketPlan = WinningTicketPlan(
    id = id,
    name = name,
    multiplier = multiplier,
    commission = commission
)

fun WinningTicketUserDto.toDomain(): WinningTicketUser = WinningTicketUser(
    id = id,
    fullName = fullName,
    username = username
)

fun WinningTicketsTotalsDto.toDomain(): WinningTicketsTotals = WinningTicketsTotals(
    totalToPay = totalToPay,
    totalPaid = totalPaid,
    totalPending = totalPending,
    winnersCount = winnersCount,
    paidCount = paidCount,
    pendingCount = pendingCount
)

fun MarkPaidResponseDto.toDomain(): MarkPaidResult = MarkPaidResult(
    ticket = ticket.toDomain(),
    prizeAmount = prizeAmount
)





