import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

// Rounded rectangles, never pills. One iris (default) button per view; the
// rest are outline or plain text. Destructive is red text only (#57).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-2 aria-invalid:ring-danger",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        destructive: "bg-transparent text-danger hover:bg-danger/10",
        outline: "border border-line bg-transparent text-foreground hover:bg-selected",
        secondary: "bg-selected text-foreground hover:bg-selected/70",
        ghost: "text-foreground hover:bg-selected",
        link: "text-iris underline-offset-4 hover:underline",
      },
      // Controls are at least 44px tall on touch; sm and icon tighten to
      // 36px from the md breakpoint, where a pointer is the norm.
      size: {
        default: "h-11 px-4 has-[>svg]:px-3.5",
        sm: "h-11 md:h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 has-[>svg]:px-4",
        icon: "size-11 md:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
