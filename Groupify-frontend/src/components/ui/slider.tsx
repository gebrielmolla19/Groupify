"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "./utils";

interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  variant?: 'default' | 'volume';
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant = 'default',
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  const isVolume = variant === 'volume';

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full",
          isVolume 
            ? "h-3 bg-muted/30" 
            : "bg-muted data-[orientation=horizontal]:h-4 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
        style={isVolume ? { backgroundColor: 'rgba(255, 255, 255, 0.1)' } : undefined}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            isVolume ? "" : "bg-primary"
          )}
          style={isVolume ? { backgroundColor: '#FFFFFF' } : undefined}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block shrink-0 rounded-full border transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
            isVolume
              ? "size-4 border-white shadow-none"
              : "border-primary bg-background ring-ring/50 size-4 shadow-sm"
          )}
          style={isVolume ? { 
            backgroundColor: '#FFFFFF', 
            borderColor: '#FFFFFF',
            boxShadow: 'none'
          } : undefined}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
