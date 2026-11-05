# syntax=docker/dockerfile:1.7
FROM --platform=$BUILDPLATFORM ghcr.io/cirruslabs/android-sdk:35 AS build

LABEL org.opencontainers.image.source="https://github.com/CST438-Project-3/DoodleDungeon"

WORKDIR /workspace

# Resolve plugins and dependencies before copying source so Docker can reuse this layer.
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
# Use the JDK bundled in the Android SDK image; omit the local daemon-JDK criteria.
COPY gradle/wrapper/ gradle/wrapper/
COPY app/build.gradle.kts app/build.gradle.kts
RUN --mount=type=cache,target=/root/.gradle \
    sed -i 's/\r$//' gradlew \
    && chmod +x gradlew \
    && ./gradlew --no-daemon :app:dependencies --quiet

COPY app/ app/
COPY config/ config/

# The Android unit test task includes Java and Kotlin tests in app/src/test.
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon \
      :app:testDebugUnitTest \
      :app:pmdJava \
      :app:detekt \
      :app:assembleDebug

ENTRYPOINT ["./gradlew"]
CMD ["--no-daemon", ":app:testDebugUnitTest", ":app:pmdJava", ":app:detekt", ":app:assembleDebug"]
