plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("io.gitlab.arturbosch.detekt")
    id("pmd")
}

detekt {
    toolVersion = "1.23.8"
    source.setFrom("src/main/java")
    config.setFrom(files("$rootDir/config/detekt/detekt.yml"))
    buildUponDefaultConfig = true
}

pmd {
    toolVersion = "7.16.0"
    ruleSetFiles = files("$rootDir/config/pmd/ruleset.xml")
    ruleSets = emptyList()
    isIgnoreFailures = false
}

// Android modules do not expose the Java Plugin's pmdMain source set task.
// Keep PMD scoped to Java sources in this module; Kotlin is checked by Detekt.
tasks.register<Pmd>("pmdJava") {
    group = "verification"
    description = "Runs PMD against Java sources in the app module."
    source(fileTree("src/main/java") { include("**/*.java") })
    classpath = files()
    ruleSetFiles = files("$rootDir/config/pmd/ruleset.xml")
    ruleSets = emptyList()
}

android {
    namespace = "com.example.doodledungeon"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.doodledungeon"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2023.08.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    
    // We are adding the browser dependency here for GitHub OAuth!
    implementation("androidx.browser:browser:1.8.0")
    
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2023.08.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
