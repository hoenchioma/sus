import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The site the app opens. Each deployment builds its own APK, so this comes from the build, not the code:
// SUS_URL=https://sus.example.com ./gradlew assembleRelease
val susUrl: String = (System.getenv("SUS_URL") ?: (findProperty("susUrl") as String?) ?: "").trimEnd('/')

tasks.configureEach {
    if (name == "preBuild") doFirst {
        if (susUrl.isEmpty()) throw GradleException("Set SUS_URL (or -PsusUrl) to the deployed site, e.g. https://sus.example.com")
    }
}

// Release signing comes from the environment so the keystore never lands in the repo.
val keystoreFile = System.getenv("SUS_KEYSTORE")?.let(::file)

android {
    namespace = "app.sus.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.sus.tv"
        // Android 5.1 and up, which covers the older TV sticks and boxes still in use.
        minSdk = 22
        targetSdk = 35
        versionCode = (System.getenv("SUS_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("SUS_VERSION_NAME") ?: "1.0"
        buildConfigField("String", "SUS_URL", "\"$susUrl\"")
    }

    signingConfigs {
        if (keystoreFile != null) {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("SUS_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SUS_KEY_ALIAS")
                keyPassword = System.getenv("SUS_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
