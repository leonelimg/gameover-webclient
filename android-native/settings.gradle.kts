pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.10.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "GameOverAndroid"

include(":app")
include(":core:core-network")
include(":core:core-data")
include(":core:core-domain")
include(":core:core-ui")
include(":feature-auth")
include(":feature-dashboard")
include(":feature-sales")
include(":feature-tickets")
include(":feature-settings")
include(":feature-bluetooth")
