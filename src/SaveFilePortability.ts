/*
 * SaveFilePortability.ts
 * -----------------------
 * Standalone, portable save export/import for PARC-family stages (PARC, The Spire, and reskins).
 *
 * WHY STANDALONE: this module deliberately depends only on a tiny interface (SavePortabilityHost),
 * not on the concrete Stage class, so it can be dropped into any stage in this family with minimal
 * wiring. To reuse it elsewhere, implement the four host methods (getSave, getAllSaves,
 * replaceCurrentSave, refreshAfterLoad) and call exportCurrentSaveToFile / importSaveFromFile.
 *
 * WHAT IT DOES:
 *  - Export: serializes the current in-memory save to a downloadable .json file (with a small
 *    metadata envelope so future versions can detect format).
 *  - Import: reads a .json file the user selects, validates the envelope, rehydrates it through the
 *    host, and loads it into the current slot - then refreshes the game.
 *
 * It intentionally does NOT touch the network/chat-state persistence; it only moves saves between
 * the running game and local files.
 */

// The minimal surface this module needs from a stage. Any stage implementing these can reuse it.
export interface SavePortabilityHost {
    // Returns the current live save object (any serializable shape).
    getSave(): any;
    // Rehydrates a plain parsed save object into proper class instances and installs it as the
    // current save, then re-initializes/refreshes the running game so the load takes effect.
    loadSaveObject(rawSave: any): void;
}

// Envelope wrapping an exported save, so imports can be validated and versioned across stages.
interface SaveFileEnvelope {
    format: string;      // constant marker identifying this as a portable save file
    formatVersion: number;
    stageId: string;     // which stage produced it (informational; import is tolerant across reskins)
    exportedAt: string;  // ISO timestamp
    save: any;           // the actual save payload
}

/**
 * Copy text to the clipboard, trying the modern async Clipboard API first and falling back to the
 * legacy execCommand path (which works in more restricted/iframe contexts). Returns true on success.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    // Modern API (needs a secure context and permission; may be unavailable in some iframes).
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to legacy path
    }
    // Legacy fallback: a temporary textarea + execCommand('copy').
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

const SAVE_FILE_FORMAT = 'parc-family-save';
const SAVE_FILE_VERSION = 1;

/**
 * Serialize the host's current save into an envelope and return both the pretty JSON text and a
 * suggested filename. The UI uses this for the download AND for the copy/manual fallback, so the
 * same data is available regardless of whether the sandbox permits a real file download.
 */
export function buildSaveExport(host: SavePortabilityHost, stageId: string = 'unknown-stage'): { text: string; filename: string } {
    const save = host.getSave();
    if (!save) {
        throw new Error('No active save to export.');
    }
    const envelope: SaveFileEnvelope = {
        format: SAVE_FILE_FORMAT,
        formatVersion: SAVE_FILE_VERSION,
        stageId,
        exportedAt: new Date().toISOString(),
        // Deep-clone via JSON to strip any class instances/functions down to plain serializable data.
        save: JSON.parse(JSON.stringify(save)),
    };
    const text = JSON.stringify(envelope, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${stageId}-save-${stamp}.json`;
    return { text, filename };
}

/**
 * Attempt to trigger a browser download of the given text as a file. Returns true if the download
 * was initiated, false if the environment appears to block it (e.g. a sandboxed iframe without the
 * 'allow-downloads' permission). A false return is the signal for the caller to use the copy/manual
 * fallback rather than leaving the user with nothing.
 */
export function tryDownloadTextAsFile(text: string, filename: string): boolean {
    try {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        // If the anchor doesn't support the download attribute, we can't do a clean file download.
        if (typeof a.download === 'undefined') {
            URL.revokeObjectURL(url);
            return false;
        }
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch {
        return false;
    }
}

/**
 * Convenience: build the export and attempt the download in one call. Returns the export payload
 * plus whether the download was initiated, so the UI can show the copy fallback when it wasn't.
 */
export function exportCurrentSaveToFile(host: SavePortabilityHost, stageId: string = 'unknown-stage'): { text: string; filename: string; downloaded: boolean } {
    const { text, filename } = buildSaveExport(host, stageId);
    const downloaded = tryDownloadTextAsFile(text, filename);
    return { text, filename, downloaded };
}

/**
 * Parse and validate a save file's text content, returning the inner save payload.
 * Throws with a human-readable message if the file isn't a valid portable save.
 * Exported separately so callers can validate without loading if they wish.
 */
export function parseSaveFile(fileText: string): { save: any; stageId: string } {
    let parsed: any;
    try {
        parsed = JSON.parse(fileText);
    } catch {
        throw new Error('This file is not valid JSON - it may be corrupted or not a save file.');
    }

    // Accept the enveloped format primarily.
    if (parsed && parsed.format === SAVE_FILE_FORMAT && parsed.save) {
        return { save: parsed.save, stageId: parsed.stageId || 'unknown-stage' };
    }

    // Tolerant fallback: if someone hands us a raw save object (no envelope) that still looks like a
    // save, accept it. We detect a save loosely by the presence of common top-level fields.
    if (parsed && (parsed.stationStats || parsed.shipConditions || parsed.actors || parsed.layout || parsed.grid || parsed.floors)) {
        return { save: parsed, stageId: 'unknown-stage' };
    }

    throw new Error("This doesn't look like a save file for this game.");
}

/**
 * Read a File (from an <input type="file">), validate it, and load it into the running game via the host.
 * Returns a promise that resolves when the load has been kicked off, or rejects with a readable error.
 */
export function importSaveFromFile(host: SavePortabilityHost, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file selected.'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.onload = () => {
            try {
                const text = typeof reader.result === 'string' ? reader.result : '';
                const { save } = parseSaveFile(text);
                host.loadSaveObject(save);
                resolve();
            } catch (err: any) {
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        };
        reader.readAsText(file);
    });
}
