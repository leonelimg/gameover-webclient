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
