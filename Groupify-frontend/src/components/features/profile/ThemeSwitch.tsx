import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";

const OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Device" },
] as const;

/**
 * Segmented switch for dark, light or match-the-device. The choice is stored
 * by next-themes (localStorage key "groupify-theme").
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      type="single"
      value={theme}
      // Radix sends "" when the active item is pressed again; keep the choice.
      onValueChange={(value) => value && setTheme(value)}
      aria-label="Theme"
      // Options are 44px on touch and tighten to 36px from md, like Button sm.
      className="gap-1 rounded-lg border border-hair p-1"
    >
      {OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-11 md:h-9 min-w-16 rounded-md px-3 text-sm font-semibold text-foreground first:rounded-md last:rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
