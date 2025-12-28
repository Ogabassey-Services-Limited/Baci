import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path, G, Circle } from 'react-native-svg';

export const GadgetPattern = () => {
    return (
        <View className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
            <Svg height="100%" width="100%">
                <Defs>
                    <Pattern
                        id="gadget-pattern"
                        patternUnits="userSpaceOnUse"
                        width="150"
                        height="150"
                    >
                        <G fill="none" stroke="#ffffff" strokeWidth="1.5">
                            {/* Phone-ish shape */}
                            <G transform="translate(20, 20) rotate(-15)">
                                <Rect x="0" y="0" width="12" height="20" rx="2" />
                            </G>

                            {/* Second phone */}
                            <G transform="translate(90, 110) rotate(10)">
                                <Rect x="0" y="0" width="10" height="18" rx="2" />
                            </G>

                            {/* Landscape tablet/screen */}
                            <G transform="translate(120, 90) rotate(5)">
                                <Rect x="0" y="3" width="18" height="12" rx="2" />
                            </G>

                            {/* Second tablet */}
                            <G transform="translate(50, 100) rotate(-8)">
                                <Rect x="0" y="0" width="20" height="14" rx="2" />
                            </G>

                            {/* Laptop shape */}
                            <G transform="translate(100, 25) rotate(5)">
                                <Rect x="0" y="0" width="22" height="14" rx="1" />
                                <Rect x="-2" y="14" width="26" height="2" rx="1" />
                            </G>

                            {/* Small circle (watch?) */}
                            <G transform="translate(70, 50) rotate(-25)">
                                <Circle cx="6" cy="6" r="2" />
                            </G>

                            {/* Second watch */}
                            <G transform="translate(20, 80)">
                                <Circle cx="6" cy="6" r="3" />
                            </G>

                            {/* Dot */}
                            <Circle cx="140" cy="20" r="2" stroke="none" fill="#ffffff" />

                            {/* Second dot */}
                            <Circle cx="40" cy="130" r="2" stroke="none" fill="#ffffff" />

                            {/* Third dot */}
                            <Circle cx="80" cy="15" r="1.5" stroke="none" fill="#ffffff" />

                            {/* Small decorative path */}
                            <Path d="M30 5 l3 3 m-3 0 l3 -3" strokeWidth="1" />

                            {/* Second decorative X */}
                            <Path d="M130 140 l4 4 m-4 0 l4 -4" strokeWidth="1" />

                            {/* Gamepad hint */}
                            <G transform="translate(55, 60) rotate(12)">
                                <Rect x="0" y="0" width="14" height="8" rx="2" />
                            </G>
                        </G>
                    </Pattern>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#gadget-pattern)" />
            </Svg>
        </View>
    );
};
