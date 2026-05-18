pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    resolutionStrategy {
        eachPlugin {
            if (requested.id.id.startsWith("com.android.")) {
                useModule("com.android.tools.build:gradle:${requested.version}")
            }
        }
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "gameover-android"

include(
    ":app",
    ":core-common",
    ":core-network",
    ":core-database",
    ":core-bluetooth",
    ":core-print",
    ":feature-login",
    ":feature-dashboard",
    ":feature-sales",
    ":feature-tickets",
    ":feature-reports"
)
