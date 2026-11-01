import { capacitorPlugins, errorMessage, field, str } from './util';

/**
 * The AI connection for SPIRE Local: which OpenAI-compatible endpoint to call, with what key and model.
 * Settings live in this device's localStorage; the key never leaves the device except to the chosen endpoint.
 */

export type ConnectionPreset = 'chub-mars' | 'chub-mercury' | 'openrouter' | 'custom';

export interface LocalConnection {
    preset: ConnectionPreset;
    baseUrl: string; // OpenAI-compatible base URL, ending in /v1 (chat/completions and models are appended).
    apiKey: string;
    model: string; // Blank uses the endpoint's default model.
    temperature: number;
}

export const CONNECTION_PRESETS: Record<ConnectionPreset, { label: string; baseUrl: string; hint: string }> = {
    'chub-mars': {
        label: 'Chub Mars',
        baseUrl: 'https://mars.chub.ai/v1',
        hint: 'Your Chub Mars subscription. Paste your Chub API key. Only works in the Android app (browsers block it).',
    },
    'chub-mercury': {
        label: 'Chub Mercury',
        baseUrl: 'https://mercury.chub.ai/v1',
        hint: 'Your Chub Mercury subscription. Paste your Chub API key. Only works in the Android app (browsers block it).',
    },
    'openrouter': {
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        hint: 'An OpenRouter API key. Pick a model with "Fetch models".',
    },
    'custom': {
        label: 'Custom',
        baseUrl: '',
        hint: 'Any OpenAI-compatible endpoint ending in /v1, such as KoboldCpp, LM Studio or text-generation-webui on your network.',
    },
};

const STORAGE_KEY = 'spire-local-connection';

export const DEFAULT_CONNECTION: LocalConnection = {
    preset: 'chub-mars',
    baseUrl: CONNECTION_PRESETS['chub-mars'].baseUrl,
    apiKey: '',
    model: '',
    temperature: 0.8,
};

export function loadConnection(): LocalConnection {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULT_CONNECTION, ...JSON.parse(raw) };
    } catch (err) {
        console.warn('Could not read the saved AI connection:', err);
    }
    return { ...DEFAULT_CONNECTION };
}

export function saveConnection(connection: LocalConnection): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
    } catch (err) {
        console.error('Could not save the AI connection:', err);
    }
}

/** A connection is usable once it has an endpoint, and a key unless it's a custom (often local) server. */
export function isConnectionConfigured(connection: LocalConnection = loadConnection()): boolean {
    return !!connection.baseUrl.trim() && (connection.preset === 'custom' || !!connection.apiKey.trim());
}

// ---------------------------------------------------------------------------------------------------------
// HTTP: plain fetch, falling back to Capacitor's native HTTP in the Android app. Chub's endpoints don't allow
// browser (CORS) requests, so they only work through the native path - the same approach as ChatForge.

interface HttpResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
}

// Hosts where a browser fetch failed (most likely CORS); go straight to native HTTP for them next time.
const nativeOnlyHosts = new Set<string>();

function nativeHttp() {
    return capacitorPlugins()?.CapacitorHttp ?? null;
}

export function isNativeApp(): boolean {
    return !!nativeHttp();
}

async function httpRequest(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<HttpResponse> {
    const host = new URL(url).host;
    const native = nativeHttp();
    if (!native || !nativeOnlyHosts.has(host)) {
        try {
            const res = await fetch(url, init);
            return { ok: res.ok, status: res.status, text: () => res.text() };
        } catch (err) {
            if (!native) throw err;
            nativeOnlyHosts.add(host);
        }
    }
    if (!native) throw new Error('Native HTTP is unavailable.');
    let data: unknown = init.body;
    if (typeof init.body === 'string') {
        try { data = JSON.parse(init.body); } catch { /* keep the string */ }
    }
    const res = await native.request({
        url,
        method: init.method,
        // Chub's firewall rejects empty or bot-like user agents.
        headers: { 'User-Agent': 'SPIRE-Local/1.0 (Android)', ...init.headers },
        data,
        responseType: 'text',
        connectTimeout: 30000,
        readTimeout: 300000,
    });
    const raw = res.data;
    return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        text: async () => (typeof raw === 'string' ? raw : JSON.stringify(raw)),
    };
}

// ---------------------------------------------------------------------------------------------------------

export class ConnectionError extends Error {}

function endpoint(connection: LocalConnection, path: string): string {
    return `${connection.baseUrl.trim().replace(/\/+$/, '')}/${path}`;
}

function authHeaders(connection: LocalConnection): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const key = connection.apiKey.trim();
    if (key) {
        headers['Authorization'] = `Bearer ${key}`;
        // Chub also accepts (and prefers) its own key header.
        if (/(^|\.)chub\.ai$/i.test(safeHost(connection.baseUrl))) headers['CH-API-KEY'] = key;
    }
    return headers;
}

function safeHost(url: string): string {
    try { return new URL(url).host; } catch { return ''; }
}

/** Turn an error response into one readable line (Chub's geo-block, bad keys, etc.). */
function describeFailure(status: number, body: string): string {
    let detail = body.trim();
    try {
        const json = JSON.parse(detail);
        detail = json?.error?.message || json?.message || json?.detail || json?.error || detail;
    } catch { /* not JSON */ }
    detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
    if (status === 401 || status === 403) {
        return `The AI endpoint refused the request (${status})${detail ? `: ${detail}` : ''}. Check your API key, or whether the service is available where you are.`;
    }
    return `The AI endpoint returned an error (${status})${detail ? `: ${detail}` : ''}.`;
}

/** Pull the text out of a chat completion, whether returned as JSON or as a server-sent-event transcript. */
function parseCompletion(body: string): string {
    const trimmed = body.trim();
    if (trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        const choice = json?.choices?.[0];
        return choice?.message?.content ?? choice?.text ?? '';
    }
    let text = '';
    for (const line of trimmed.split('\n')) {
        const payload = line.replace(/^data:\s*/, '').trim();
        if (!line.startsWith('data:') || !payload || payload === '[DONE]') continue;
        try {
            const choice = JSON.parse(payload)?.choices?.[0];
            text += choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? '';
        } catch { /* skip keep-alives */ }
    }
    return text;
}

export async function chatCompletion(
    connection: LocalConnection,
    prompt: string,
    options: { maxTokens?: number; stop?: string[] } = {},
): Promise<string> {
    if (!isConnectionConfigured(connection)) {
        throw new ConnectionError('No AI connection is set up yet. Open the main menu and choose "AI Connection".');
    }
    const body: Record<string, unknown> = {
        messages: [{ role: 'user', content: prompt }],
        temperature: connection.temperature,
        stream: false,
    };
    if (connection.model.trim()) body.model = connection.model.trim();
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    // OpenAI-compatible APIs accept at most four stop sequences.
    const stop = (options.stop || []).filter(Boolean).slice(0, 4);
    if (stop.length) body.stop = stop;

    let res: HttpResponse;
    try {
        res = await httpRequest(endpoint(connection, 'chat/completions'), {
            method: 'POST', headers: authHeaders(connection), body: JSON.stringify(body),
        });
    } catch (err) {
        throw new ConnectionError(isNativeApp()
            ? `Couldn't reach the AI endpoint: ${errorMessage(err)}`
            : `Couldn't reach the AI endpoint from this browser (it may block web pages; Chub only works in the Android app): ${errorMessage(err)}`);
    }
    const text = await res.text();
    if (!res.ok) throw new ConnectionError(describeFailure(res.status, text));
    try {
        return parseCompletion(text);
    } catch {
        throw new ConnectionError(`The AI endpoint sent a response SPIRE couldn't read: ${text.slice(0, 120)}`);
    }
}

/** List the model IDs an endpoint offers (GET /models). */
export async function listModels(connection: LocalConnection): Promise<string[]> {
    const res = await httpRequest(endpoint(connection, 'models'), { method: 'GET', headers: authHeaders(connection) });
    const text = await res.text();
    if (!res.ok) throw new ConnectionError(describeFailure(res.status, text));
    const json: unknown = JSON.parse(text);
    const list = Array.isArray(json) ? json : (field(json, 'data') ?? field(json, 'models'));
    const models: unknown[] = Array.isArray(list) ? list : [];
    return models.map(m => (typeof m === 'string' ? m : str(field(m, 'id')) || str(field(m, 'name')))).filter(Boolean).sort();
}
