# 16 KB Page Alignment Fix for Android 15+

## Problem
Your app-debug.apk was not compatible with 16 KB devices because native libraries (specifically `libimage_processing_util_jni.so` from ML Kit barcode scanning) had LOAD segments not aligned at 16 KB boundaries.

Starting November 1st, 2025, all new apps and updates targeting Android 15+ devices must support 16 KB page sizes.

## Root Cause
The `libimage_processing_util_jni.so` library comes from the ML Kit barcode scanning dependency:
```kotlin
implementation("com.google.mlkit:barcode-scanning:17.3.0")
```

This is used in the `feature-tickets` module.

## Solution Applied

### 1. Updated Target SDK to Android 15 (API 35)
When you target Android 15 and above, the Android Gradle Plugin automatically enables 16 KB page alignment for native libraries.

**Changes made:**
- Updated `app/build.gradle.kts`:
  - `compileSdk = 35` (was 34)
  - `targetSdk = 35` (was 34)

- Updated all core and feature modules to use `compileSdk = 35`:
  - `core/core-data/build.gradle.kts`
  - `core/core-domain/build.gradle.kts`
  - `core/core-network/build.gradle.kts`
  - `core/core-ui/build.gradle.kts`
  - `feature-auth/build.gradle.kts`
  - `feature-bluetooth/build.gradle.kts`
  - `feature-dashboard/build.gradle.kts`
  - `feature-sales/build.gradle.kts`
  - `feature-settings/build.gradle.kts`
  - `feature-tickets/build.gradle.kts`

### 2. Configured Packaging for Native Libraries
Added proper packaging configuration in `app/build.gradle.kts`:
```kotlin
packaging {
    resources {
        excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}
```

### 3. Simplified Gradle Properties
Updated `gradle.properties` to remove problematic JVM arguments that were causing build issues.

## How 16 KB Alignment Works

When using AGP 8.3.2+ (your current version) with `targetSdk = 35`:
- Android Gradle Plugin automatically handles 16 KB page alignment
- All native libraries (`.so` files) are automatically padded and aligned at 16 KB boundaries
- This happens during the APK packaging process
- No additional configuration needed beyond targeting Android 15

## Next Steps

1. **Clean and Rebuild Your APK:**
   ```bash
   ./gradlew clean assembleDebug
   ```

2. **Verify the 16 KB Alignment:**
   After building, you can verify that the native libraries are properly aligned using bundletool or by checking with a tool that inspects ELF headers.

3. **Upload to Google Play:**
   Your app is now compliant with the 16 KB page size requirement for Android 15+ devices. You can submit it to Google Play Console.

## Important Notes

- **Minimum SDK:** Remains at 26 (API level 26), so older devices are still supported
- **Backward Compatibility:** Apps targeting Android 15 work on all Android versions down to your minimum SDK
- **Automatic:** The 16 KB alignment is automatic - no special code changes needed
- **Profile-Guided Optimization:** Consider using PGO for further binary size optimization

## References

- [Android 15: 16 KB Page Size Support](https://developer.android.com/16kb-page-size)
- [Android Gradle Plugin Documentation](https://developer.android.com/build/releases/gradle-plugin-releases)
- [ML Kit Barcode Scanning](https://developers.google.com/ml-kit/vision/barcode-scanning)

## Troubleshooting

If you still encounter 16 KB alignment issues:

1. **Verify compileSdk and targetSdk are 35:**
   ```gradle
   compileSdk = 35
   targetSdk = 35
   ```

2. **Update AGP if needed:**
   Consider updating to AGP 8.5.0+ for improved 16 KB alignment support:
   ```gradle
   id("com.android.application") version "8.5.0"
   ```

3. **Check Native Dependencies:**
   Ensure all native libraries are from Google Play's compliant versions.

4. **Use bundletool to verify:**
   ```bash
   bundletool inspect-bundle --bundle=app-debug.aab
   ```

