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

const SAVE_FILE_FORMAT = 'parc-family-save';
const SAVE_FILE_VERSION = 1;

/**
 * Serialize the host's current save into a downloadable .json file and trigger the browser download.
 * `stageId` is stamped into the file for traceability (e.g. 'spire-parc-fantasy-reskin').
 */
export function exportCurrentSaveToFile(host: SavePortabilityHost, stageId: string = 'unknown-stage'): void {
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

    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Build a friendly, timestamped filename.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${stageId}-save-${stamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Release the object URL after a tick so the download can start.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
