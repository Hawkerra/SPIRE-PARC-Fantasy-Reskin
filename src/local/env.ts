/**
 * True in the standalone "SPIRE Local" build (`vite build --mode standalone`), which runs on the player's own
 * device instead of inside Chub: it brings its own AI connection, stores saves on the device, and summons
 * from uploaded character cards. Vite inlines this as a constant, so local-only branches drop out of the
 * Chub build entirely.
 */
export const IS_LOCAL = import.meta.env.MODE === 'standalone';
