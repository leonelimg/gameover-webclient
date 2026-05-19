package com.gameover.android.core.domain.usecase

import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.repository.DrawsRepository
import javax.inject.Inject

class GetDrawsUseCase @Inject constructor(private val drawsRepository: DrawsRepository) {
    suspend operator fun invoke(): Result<List<Draw>> = runCatching { drawsRepository.getDraws() }
}
