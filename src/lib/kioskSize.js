/** Shared kiosk screen size — 3D mesh + HTML overlay must match aspect. */
export const KIOSK_PANEL_W = 400
export const KIOSK_CAB_W = 0.82
/** Shorter white cabinet; legs (postH) raised so screen center stays near eye height. */
export const KIOSK_CAB_H = 1.4
export const KIOSK_POST_H = 0.5
export const KIOSK_BEZEL = 0.03

export const KIOSK_SCREEN_W = KIOSK_CAB_W - KIOSK_BEZEL * 2
export const KIOSK_SCREEN_H = KIOSK_CAB_H - KIOSK_BEZEL * 2
export const KIOSK_PANEL_H = Math.round(KIOSK_PANEL_W * (KIOSK_SCREEN_H / KIOSK_SCREEN_W))
