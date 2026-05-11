'use client';

import { colord } from 'colord';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

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
  const [isHexValid, setIsHexValid] = useState(true);
  const hexInputRef = useRef(parsedColor.toHex());

  // Track if we're currently dragging - using state so it's available during render
  const [_isDraggingSatLight, setIsDraggingSatLight] = useState(false);
  const [_isDraggingHue, setIsDraggingHue] = useState(false);
  // Use ref for synchronous access in useEffect to avoid race conditions
  const isDraggingRef = useRef(false);
  const lastPropColorRef = useRef(color);

  const satLightBoxRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Sync internal state when prop changes externally (not from our own onChange)
  // This is an intentional controlled component pattern for prop-to-state sync
  useEffect(() => {
    if (lastPropColorRef.current !== color && !isDraggingRef.current) {
      const newParsedColor = colord(color);
      const newHsl = newParsedColor.toHsl();
      setInternalHue(newHsl.h);
      setInternalSaturation(newHsl.s);
      setInternalLightness(newHsl.l);
      lastPropColorRef.current = color;
      setIsHexValid(true);
      // Also update hex input if it wasn't the source of the change
      const newHex = newParsedColor.toHex();
      if (hexInputRef.current !== newHex) {
        setHexInput(newHex);
        hexInputRef.current = newHex;
      }
    }
  }, [color]);

  // Always use internal state for rendering to preserve precision and avoid
  // lossy Hex->HSL conversion issues (e.g. losing Hue in grayscale).
  // The useEffect above handles syncing from props when necessary.
  const hue = internalHue;
  const saturation = internalSaturation;
  const lightness = internalLightness;
  const hex = colord({ h: hue, s: saturation, l: lightness }).toHex();

  // Update color and notify parent
  const updateColor = (h: number, s: number, l: number) => {
    const newHex = colord({ h, s, l }).toHex();
    lastPropColorRef.current = newHex;
    setHexInput(newHex);
    hexInputRef.current = newHex;
    onChange(newHex);
  };

  const handleSatLightChange = (
    e:
      | MouseEvent
      | TouchEvent
      | React.MouseEvent<HTMLDivElement>
      | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!satLightBoxRef.current) return;

    const rect = satLightBoxRef.current.getBoundingClientRect();
    const clientX =
      'touches' in e
        ? (e as TouchEvent).touches[0].clientX
        : (e as MouseEvent).clientX;
    const clientY =
      'touches' in e
        ? (e as TouchEvent).touches[0].clientY
        : (e as MouseEvent).clientY;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const newSaturation = (x / rect.width) * 100;
    const newLightness = 100 - (y / rect.height) * 100;

    setInternalSaturation(newSaturation);
    setInternalLightness(newLightness);
    updateColor(internalHue, newSaturation, newLightness);
  };

  const handleHueChange = (
    e:
      | MouseEvent
      | TouchEvent
      | React.MouseEvent<HTMLDivElement>
      | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const clientX =
      'touches' in e
        ? (e as TouchEvent).touches[0].clientX
        : (e as MouseEvent).clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const newHue = (x / rect.width) * 360;

    setInternalHue(newHue);
    updateColor(newHue, internalSaturation, internalLightness);
  };

  const handleMouseUp = () => {
    setIsDraggingSatLight(false);
    setIsDraggingHue(false);
    isDraggingRef.current = false;
  };

  const handleMouseDownSatLight = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    // Prevent text selection during drag
    if (e.type === 'mousedown') {
      e.preventDefault();
    }
    setIsDraggingSatLight(true);
    isDraggingRef.current = true;
    handleSatLightChange(e);

    const onMove = (moveEvent: MouseEvent | TouchEvent) =>
      handleSatLightChange(moveEvent);
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

  const handleMouseDownHue = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    // Prevent text selection during drag
    if (e.type === 'mousedown') {
      e.preventDefault();
    }
    setIsDraggingHue(true);
    isDraggingRef.current = true;
    handleHueChange(e);

    const onMove = (moveEvent: MouseEvent | TouchEvent) =>
      handleHueChange(moveEvent);
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
        role="slider"
        tabIndex={0}
        aria-label="Saturation and lightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(saturation)}
        className="w-full h-36 rounded-md cursor-pointer relative focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
        style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        onMouseDown={handleMouseDownSatLight}
        onTouchStart={handleMouseDownSatLight}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowRight') {
            updateColor(hue, Math.min(100, saturation + step), lightness);
            e.preventDefault();
          }
          if (e.key === 'ArrowLeft') {
            updateColor(hue, Math.max(0, saturation - step), lightness);
            e.preventDefault();
          }
          if (e.key === 'ArrowUp') {
            updateColor(hue, saturation, Math.min(100, lightness + step));
            e.preventDefault();
          }
          if (e.key === 'ArrowDown') {
            updateColor(hue, saturation, Math.max(0, lightness - step));
            e.preventDefault();
          }
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, white, transparent)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, black, transparent)' }}
        />
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
        <Label id="hue-label">Hue</Label>
        <div
          ref={hueSliderRef}
          role="slider"
          tabIndex={0}
          aria-labelledby="hue-label"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hue)}
          className="relative h-4 w-full cursor-pointer rounded-full focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{
            background:
              'linear-gradient(to right, rgb(255, 0, 0) 0%, rgb(255, 255, 0) 17%, rgb(0, 255, 0) 33%, rgb(0, 255, 255) 50%, rgb(0, 0, 255) 67%, rgb(255, 0, 255) 83%, rgb(255, 0, 0) 100%)',
          }}
          onMouseDown={handleMouseDownHue}
          onTouchStart={handleMouseDownHue}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 30 : 5;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              updateColor((hue + step) % 360, saturation, lightness);
              e.preventDefault();
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              updateColor((hue - step + 360) % 360, saturation, lightness);
              e.preventDefault();
            }
          }}
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
            const isValid = parsed.isValid();
            setIsHexValid(isValid);

            if (isValid) {
              const newHsl = parsed.toHsl();
              setInternalHue(newHsl.h);
              setInternalSaturation(newHsl.s);
              setInternalLightness(newHsl.l);
              lastPropColorRef.current = parsed.toHex();
              onChange(parsed.toHex());
            }
          }}
          aria-invalid={!isHexValid}
          className={`font-mono ${!isHexValid ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        />
      </div>
    </div>
  );
}
