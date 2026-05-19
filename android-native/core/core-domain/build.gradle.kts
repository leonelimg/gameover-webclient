plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.gameover.android.core.domain"
    compileSdk = 34

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Coroutines only — no Android-specific dependencies
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    // JSR-330 for @Inject annotations (Hilt-compatible, no Hilt dependency needed)
    implementation("javax.inject:javax.inject:1")
    // Gson for use-case serialization
    implementation("com.google.code.gson:gson:2.10.1")
}
