/** Shared kiosk screen size — 3D mesh + HTML overlay must match aspect. */
export const KIOSK_PANEL_W = 400
export const KIOSK_CAB_W = 0.82
/** Shorter white cabinet; legs (postH) raised so screen center stays near eye height. */
export const KIOSK_CAB_H = 1.4
export const KIOSK_POST_H = 0.5
/** Silver frame around the live screen — thick enough to read as a body, not a sticker. */
export const KIOSK_BEZEL = 0.058

export const KIOSK_SCREEN_W = KIOSK_CAB_W - KIOSK_BEZEL * 2
export const KIOSK_SCREEN_H = KIOSK_CAB_H - KIOSK_BEZEL * 2
export const KIOSK_PANEL_H = Math.round(KIOSK_PANEL_W * (KIOSK_SCREEN_H / KIOSK_SCREEN_W))
/** Screen + cabinet corner radius (CSS px and matching meters). */
export const KIOSK_RADIUS_PX = 40
export const KIOSK_RADIUS_M = KIOSK_RADIUS_PX * (KIOSK_SCREEN_W / KIOSK_PANEL_W)
