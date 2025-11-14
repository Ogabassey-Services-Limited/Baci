
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { colord } from 'colord';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [hue, setHue] = useState(() => colord(color).toHsl().h);
  const [saturation, setSaturation] = useState(() => colord(color).toHsl().s);
  const [lightness, setLightness] = useState(() => colord(color).toHsl().l);
  const [hex, setHex] = useState(() => colord(color).toHex());

  const satLightBoxRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const newColor = colord({ h: hue, s: saturation, l: lightness });
    const newHex = newColor.toHex();
    // Only update if the color has actually changed to avoid feedback loops
    if (newHex !== colord(color).toHex()) {
      setHex(newHex);
      onChange(newHex);
    }
  }, [hue, saturation, lightness, color, onChange]);

  // Update internal state when the parent color prop changes
  useEffect(() => {
    const newColor = colord(color);
    if (newColor.isValid()) {
        const newHsl = newColor.toHsl();
        setHue(newHsl.h);
        setSaturation(newHsl.s);
        setLightness(newHsl.l);
        setHex(newColor.toHex());
    }
  }, [color]);

  const handleSatLightChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!satLightBoxRef.current) return;

    const rect = satLightBoxRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const newSaturation = (x / rect.width) * 100;
    const newLightness = 100 - (y / rect.height) * 100;

    setSaturation(newSaturation);
    setLightness(newLightness);
  };
  
  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (isDraggingRef.current) {
      handleSatLightChange(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };
  
  const handleMouseUp = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleMouseMove);
    document.removeEventListener('touchend', handleMouseUp);
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    handleSatLightChange(e);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);
  };

  return (
    <div className="space-y-4 w-64">
      <div
        ref={satLightBoxRef}
        className="w-full h-36 rounded-md cursor-pointer relative"
        style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
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
        <Slider
          min={0}
          max={360}
          value={[hue]}
          onValueChange={([val]) => setHue(val)}
          className="bg-transparent [--slider-track-background:linear-gradient(to_right,rgb(255,0,0)_0%,rgb(255,255,0)_17%,rgb(0,255,0)_33%,rgb(0,255,255)_50%,rgb(0,0,255)_67%,rgb(255,0,255)_83%,rgb(255,0,0)_100%)]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hex-input">Hex Color</Label>
        <Input
          id="hex-input"
          value={hex}
          onChange={(e) => {
              const newHex = e.target.value;
              setHex(newHex);
              if (colord(newHex).isValid()) {
                  onChange(newHex);
              }
          }}
          className="font-mono"
        />
      </div>
    </div>
  );
}
