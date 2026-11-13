/**
 * Height of the phone tab bar above the safe area (1px border + 4px top
 * padding + 52px tabs + 12px bottom padding). Fixed UI on phones sits above it.
 */
export const TAB_BAR_HEIGHT = 69;

/** Height of the phone mini player (44px controls + 8px padding top and bottom). */
export const PLAYER_CARD_HEIGHT = 60;

/** Gap between stacked fixed elements at the bottom of the screen. */
export const STACK_GAP = 8;

/** On phones, the mini player's top edge, measured from above the safe area. */
export const PHONE_PLAYER_TOP = TAB_BAR_HEIGHT + STACK_GAP + PLAYER_CARD_HEIGHT;

/** Height of the desktop player bar under the panes. */
export const DESKTOP_PLAYER_HEIGHT = 76;
