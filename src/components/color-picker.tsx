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

  useEffect(() => {
    const newColor = colord({ h: hue, s: saturation, l: lightness });
    const newHex = newColor.toHex();
    if (newHex !== colord(color).toHex()) {
      setHex(newHex);
      onChange(newHex);
    }
  }, [hue, saturation, lightness, color, onChange]);

  useEffect(() => {
    const newColor = colord(color);
    setHue(newColor.toHsl().h);
    setSaturation(newColor.toHsl().s);
    setLightness(newColor.toHsl().l);
    setHex(newColor.toHex());
  }, [color]);

  const handleSatLightChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!satLightBoxRef.current) return;

    const rect = satLightBoxRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const newSaturation = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newLightness = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));

    setSaturation(newSaturation);
    setLightness(newLightness);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    handleSatLightChange(e as unknown as React.MouseEvent<HTMLDivElement>);
  };
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSatLightChange(e);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="space-y-4 w-64">
      <div
        ref={satLightBoxRef}
        className="w-full h-36 rounded-md cursor-pointer relative"
        style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, white, transparent)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, black, transparent)' }} />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md"
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
          className="[&>span:first-child]:h-full [&>span:first-child]:bg-transparent [&>span:first-child]:[background:linear-gradient(to_right,rgb(255,0,0)_0%,rgb(255,255,0)_17%,rgb(0,255,0)_33%,rgb(0,255,255)_50%,rgb(0,0,255)_67%,rgb(255,0,255)_83%,rgb(255,0,0)_100%)]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hex-input">Hex Color</Label>
        <Input
          id="hex-input"
          value={hex}
          onChange={(e) => {
              const newHex = e.target.value;
              if (/^#?([0-9A-Fa-f]{3}){1,2}$/.test(newHex)) {
                  setHex(newHex);
                  if (colord(newHex).isValid()) {
                      onChange(newHex);
                  }
              } else {
                  setHex(newHex);
              }
          }}
          className="font-mono"
        />
      </div>
    </div>
  );
}
