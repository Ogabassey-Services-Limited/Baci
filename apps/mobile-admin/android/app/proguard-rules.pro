# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Protect malformed Amazon SDK bytecode without disabling R8 globally.
-dontwarn com.amazon.**
-keep,allowshrinking,allowobfuscation,allowoptimization class com.amazon.** { *; }
-keepattributes *Annotation*

# Repackage classes for stronger R8 optimization on AGP 8.x.
-repackageclasses
