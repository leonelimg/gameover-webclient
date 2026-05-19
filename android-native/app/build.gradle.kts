plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
}

val debugApiBaseUrl: String = (project.findProperty("GO_API_BASE_URL") as String?) ?: "http://10.0.2.2:4000"
val releaseApiBaseUrl: String = (project.findProperty("GO_API_BASE_URL_RELEASE") as String?) ?: "https://api.gameover.local"

android {
    namespace = "com.gameover.android.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.gameover.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(project(":core-common"))
    implementation(project(":core-network"))
    implementation(project(":core-database"))
    implementation(project(":core-bluetooth"))
    implementation(project(":core-print"))
    implementation(project(":feature-login"))
    implementation(project(":feature-dashboard"))
    implementation(project(":feature-sales"))
    implementation(project(":feature-tickets"))
    implementation(project(":feature-reports"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.hilt.android)
    implementation(libs.androidx.hilt.navigation.compose)
    kapt(libs.hilt.compiler)
    implementation(libs.timber)

    debugImplementation(libs.androidx.compose.ui.tooling)
}
