'use client';

import React, { useState, useRef, useCallback } from 'react';
import { colord } from 'colord';
import { Input } from './ui/input';
import { Label } from './ui/label';


interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

/**
 * An interactive color picker with a saturation/lightness box, hue slider, and hex input.
 *
 * @param color - The current color used to initialize and keep the control in sync when the user is not dragging; accepts any CSS color string but `onChange` is called with a hex string.
 * @param onChange - Callback invoked with the new color as a hex string whenever the user picks a color (via dragging or entering a valid hex).
 * @returns A JSX element rendering the color picker UI.
 */
export function ColorPicker({ color, onChange }: ColorPickerProps) {
  // Parse the incoming color prop
  const parsedColor = colord(color);
  const incomingHsl = parsedColor.toHsl();

  // Internal state for HSL values during dragging
  const [internalHue, setInternalHue] = useState(incomingHsl.h);
  const [internalSaturation, setInternalSaturation] = useState(incomingHsl.s);
  const [internalLightness, setInternalLightness] = useState(incomingHsl.l);

  // Separate state for hex input to allow typing partial values
  const [hexInput, setHexInput] = useState(parsedColor.toHex());
  const hexInputRef = useRef(parsedColor.toHex());

  // Track if we're currently dragging to use internal state vs prop
  const isDraggingSatLightRef = useRef(false);
  const isDraggingHueRef = useRef(false);
  const lastPropColorRef = useRef(color);

  const satLightBoxRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Sync internal state when prop changes externally (not from our own onChange)
  if (lastPropColorRef.current !== color && !isDraggingSatLightRef.current && !isDraggingHueRef.current) {
    const newHsl = parsedColor.toHsl();
    setInternalHue(newHsl.h);
    setInternalSaturation(newHsl.s);
    setInternalLightness(newHsl.l);
    lastPropColorRef.current = color;
    // Also update hex input if it wasn't the source of the change
    if (hexInputRef.current !== parsedColor.toHex()) {
      setHexInput(parsedColor.toHex());
      hexInputRef.current = parsedColor.toHex();
    }
  }

  // Use internal state when dragging, otherwise derive from prop
  const isDragging = isDraggingSatLightRef.current || isDraggingHueRef.current;
  const hue = isDragging ? internalHue : incomingHsl.h;
  const saturation = isDragging ? internalSaturation : incomingHsl.s;
  const lightness = isDragging ? internalLightness : incomingHsl.l;
  const hex = colord({ h: hue, s: saturation, l: lightness }).toHex();

  // Update color and notify parent
  const updateColor = useCallback((h: number, s: number, l: number) => {
    const newHex = colord({ h, s, l }).toHex();
    lastPropColorRef.current = newHex;
    setHexInput(newHex);
    hexInputRef.current = newHex;
    onChange(newHex);
  }, [onChange]);

  const handleSatLightChange = (e: MouseEvent | TouchEvent | React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!satLightBoxRef.current) return;

    const rect = satLightBoxRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const newSaturation = (x / rect.width) * 100;
    const newLightness = 100 - (y / rect.height) * 100;

    setInternalSaturation(newSaturation);
    setInternalLightness(newLightness);
    updateColor(internalHue, newSaturation, newLightness);
  };

  const handleHueChange = (e: MouseEvent | TouchEvent | React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const newHue = (x / rect.width) * 360;

    setInternalHue(newHue);
    updateColor(newHue, internalSaturation, internalLightness);
  };

  const handleMouseUp = () => {
    isDraggingSatLightRef.current = false;
    isDraggingHueRef.current = false;
  };

  const handleMouseDownSatLight = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    isDraggingSatLightRef.current = true;
    // Initialize internal state from current values
    setInternalHue(hue);
    setInternalSaturation(saturation);
    setInternalLightness(lightness);
    handleSatLightChange(e);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => handleSatLightChange(moveEvent);
    const onUp = () => {
      handleMouseUp();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  };

  const handleMouseDownHue = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    isDraggingHueRef.current = true;
    // Initialize internal state from current values
    setInternalHue(hue);
    setInternalSaturation(saturation);
    setInternalLightness(lightness);
    handleHueChange(e);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => handleHueChange(moveEvent);
    const onUp = () => {
      handleMouseUp();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  };

  return (
    <div className="space-y-4 w-64">
      <div
        ref={satLightBoxRef}
        className="w-full h-36 rounded-md cursor-pointer relative"
        style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        onMouseDown={handleMouseDownSatLight}
        onTouchStart={handleMouseDownSatLight}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, white, transparent)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, black, transparent)' }} />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${saturation}%`,
            top: `${100 - lightness}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: hex,
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Hue</Label>
        <div
          ref={hueSliderRef}
          className="relative h-4 w-full cursor-pointer rounded-full"
          style={{ background: 'linear-gradient(to right, rgb(255, 0, 0) 0%, rgb(255, 255, 0) 17%, rgb(0, 255, 0) 33%, rgb(0, 255, 255) 50%, rgb(0, 0, 255) 67%, rgb(255, 0, 255) 83%, rgb(255, 0, 0) 100%)' }}
          onMouseDown={handleMouseDownHue}
          onTouchStart={handleMouseDownHue}
        >
          <div
            className="absolute h-5 w-5 -top-0.5 rounded-full border-2 border-white bg-transparent shadow-md pointer-events-none"
            style={{
              left: `${(hue / 360) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hex-input">Hex Color</Label>
        <Input
          id="hex-input"
          value={hexInput}
          onChange={(e) => {
            const newHex = e.target.value;
            setHexInput(newHex);
            hexInputRef.current = newHex;
            const parsed = colord(newHex);
            if (parsed.isValid()) {
              const newHsl = parsed.toHsl();
              setInternalHue(newHsl.h);
              setInternalSaturation(newHsl.s);
              setInternalLightness(newHsl.l);
              lastPropColorRef.current = parsed.toHex();
              onChange(parsed.toHex());
            }
          }}
          className="font-mono"
        />
      </div>
    </div>
  );
}