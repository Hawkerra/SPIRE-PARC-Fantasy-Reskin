import { errorMessage } from './util';

/**
 * On-device save storage for SPIRE Local. Chub keeps a stage's "chat state" (all save slots) on its servers;
 * locally it lives in IndexedDB, which (unlike localStorage) has room for portraits stored inside saves.
 *
 * SPIRE saves after almost every action, so writes are debounced, then flushed whenever the app is hidden.
 */

const DB_NAME = 'spire-local';
const STORE = 'kv';
const STATE_KEY = 'chatState';
const SAVE_DELAY_MS = 500;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
}

async function idbGet(key: string): Promise<unknown> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbPut(key: string, value: unknown): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/** The saved chat state (every save slot), or null on first run. */
export async function loadChatState(): Promise<unknown> {
    try {
        const raw = await idbGet(STATE_KEY);
        return typeof raw === 'string' ? JSON.parse(raw) : null;
    } catch (err) {
        console.error('Could not read saves from this device:', err);
        return null;
    }
}

let pendingState: unknown = undefined;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let onSaveError: ((message: string) => void) | null = null;

export function setSaveErrorHandler(handler: (message: string) => void): void {
    onSaveError = handler;
}

/** Queue a write of the latest chat state. Serialized at write time, so the newest version always wins. */
export function scheduleChatStateSave(state: unknown): void {
    pendingState = state;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flushChatStateSave(); }, SAVE_DELAY_MS);
}

export async function flushChatStateSave(): Promise<void> {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (pendingState === undefined) return;
    const state = pendingState;
    pendingState = undefined;
    try {
        // JSON matches what Chub stores (plain data, no class instances or functions).
        await idbPut(STATE_KEY, JSON.stringify(state));
    } catch (err) {
        console.error('Could not save to this device:', err);
        onSaveError?.(`Saving failed on this device: ${errorMessage(err)}. Export your save from Save Game to be safe.`);
    }
}

let flushHooksInstalled = false;

/** Write any queued save immediately when the app goes to the background or the page closes. */
export function installFlushOnHide(): void {
    if (flushHooksInstalled) return;
    flushHooksInstalled = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void flushChatStateSave();
    });
    window.addEventListener('pagehide', () => { void flushChatStateSave(); });
}
