/** Dispatched by 3D photo frames; PhotoPage opens the modal. */
export const CABIN_PHOTO_EVENT = 'metrotapes:cabin-photo'

export function openCabinPhoto(photo, photos) {
  window.dispatchEvent(new CustomEvent(CABIN_PHOTO_EVENT, {
    detail: { photo, photos },
  }))
}
