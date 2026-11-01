/** Window event the LocalRunner listens for to show the AI Connection screen. */
export const OPEN_CONNECTION_EVENT = 'spire-local:open-connection';

/** Open SPIRE Local's AI Connection screen from anywhere in the game (e.g. the main menu). */
export function openConnectionSettings(): void {
    window.dispatchEvent(new Event(OPEN_CONNECTION_EVENT));
}
