"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useIsMobile } from "./use-mobile";
import { DESKTOP_PLAYER_HEIGHT, PHONE_PLAYER_TOP, STACK_GAP } from "../../lib/layout";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  // On phones, keep toasts above the mini player and tab bar (the safe area
  // is added per toast); on desktop, above the player bar.
  const tabBarOffset = useIsMobile() ? { bottom: PHONE_PLAYER_TOP + STACK_GAP } : { bottom: DESKTOP_PLAYER_HEIGHT + STACK_GAP };

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={tabBarOffset}
      mobileOffset={tabBarOffset}
      toastOptions={{
        style: {
          maxWidth: 'calc(100vw - 2rem)',
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
