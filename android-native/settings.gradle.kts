pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
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
