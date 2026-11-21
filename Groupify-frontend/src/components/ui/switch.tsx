"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "../../lib/utils";

// Iris track when on, line track when off. The thumb takes the matching
// foreground so it stays visible in both light and dark mode.
// The button is 44px tall so it is easy to tap (#57); the 26px track is drawn
// by its ::before, which also carries the focus ring.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center p-0.5 outline-none before:absolute before:inset-x-0 before:top-1/2 before:h-[26px] before:-translate-y-1/2 before:rounded-full before:transition-colors before:content-[''] focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-offset-2 focus-visible:before:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-switch-background",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none relative block size-[22px] rounded-full transition-transform duration-200 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary-foreground data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
