"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{
        height: 26,
        width: 44,
        minWidth: 44,
        padding: 2,
        ...style,
      }}
      {...props}
    >
      <style>{`
        [data-slot="switch"][data-state="checked"] { background-color: #1db954; }
        [data-slot="switch"][data-state="unchecked"] { background-color: #222; border: 2px solid #555; }
        [data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"] {
          transform: translateX(18px);
        }
        [data-slot="switch"][data-state="unchecked"] [data-slot="switch-thumb"] {
          transform: translateX(0px);
        }
      `}</style>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full transition-all duration-200"
        style={{
          height: 20,
          width: 20,
          minWidth: 20,
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
