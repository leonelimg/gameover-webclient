package com.gameover.android.core.domain.usecase

import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.repository.ReportsRepository
import javax.inject.Inject

class GetReportSummaryUseCase @Inject constructor(private val reportsRepository: ReportsRepository) {
    suspend operator fun invoke(
        fromDate: String? = null,
        toDate: String? = null,
        drawId: String? = null,
    ): Result<ReportSummary> = runCatching { reportsRepository.getSummary(fromDate, toDate, drawId) }
}
