/**
 * Styled components with NativeWind v4 cssInterop
 * This enables className prop on React Native core components
 */

import { cssInterop } from "nativewind";
import {
    View as RNView,
    Text as RNText,
    Pressable as RNPressable,
    TextInput as RNTextInput,
    ScrollView as RNScrollView,
    Image as RNImage,
    FlatList as RNFlatList,
} from "react-native";
import { Image as ExpoImage } from "expo-image";

// Enable className prop on React Native components
cssInterop(RNView, { className: "style" });
cssInterop(RNText, { className: "style" });
cssInterop(RNPressable, { className: "style" });
cssInterop(RNTextInput, { className: "style" });
cssInterop(RNScrollView, { className: "style" });
cssInterop(RNImage, { className: "style" });
cssInterop(RNFlatList, { className: "style" });
cssInterop(ExpoImage, { className: "style" });

// Re-export for use throughout the app
export const View = RNView;
export const Text = RNText;
export const Pressable = RNPressable;
export const TextInput = RNTextInput;
export const ScrollView = RNScrollView;
export const Image = ExpoImage;
export const FlatList = RNFlatList;
