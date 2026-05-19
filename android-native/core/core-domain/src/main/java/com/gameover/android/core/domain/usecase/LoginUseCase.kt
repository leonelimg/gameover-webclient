package com.gameover.android.core.domain.usecase

import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.repository.LoginResult
import javax.inject.Inject

class LoginUseCase @Inject constructor(private val authRepository: AuthRepository) {
    suspend operator fun invoke(username: String, password: String): Result<LoginResult> =
        runCatching { authRepository.login(username, password) }
}
