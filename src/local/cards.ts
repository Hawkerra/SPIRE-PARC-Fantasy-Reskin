import { downscaleImage } from './images';
import { field, str } from './util';

/**
 * Reads character cards for summoning in SPIRE Local: PNG cards with embedded data (SillyTavern/TavernAI V1-V3,
 * Chub downloads) and JSON cards (V1/V2/V3, Pygmalion-style, or Chub's own export format).
 */

export interface CharacterCard {
    name: string;
    description: string;
    personality: string;
    scenario: string;
}

export interface UploadedCard {
    card: CharacterCard;
    avatar: string | null; // Downscaled data URL of the card art; null for JSON cards.
}

export class CardError extends Error {}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_SOURCE_CHARS = 16000; // Keeps the AI distillation prompt a sensible size for huge cards.

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Collect a PNG's text chunks (tEXt, zTXt, iTXt) as keyword -> text. */
async function readPngText(buffer: ArrayBuffer): Promise<Record<string, string>> {
    const bytes = new Uint8Array(buffer);
    if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) throw new CardError('That file is not a PNG image.');
    const view = new DataView(buffer);
    const latin1 = new TextDecoder('latin1');
    const utf8 = new TextDecoder('utf-8');
    const texts: Record<string, string> = {};
    let offset = 8;
    while (offset + 8 <= bytes.length) {
        const length = view.getUint32(offset);
        const type = latin1.decode(bytes.subarray(offset + 4, offset + 8));
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        offset += 12 + length;
        if (type === 'IEND') break;
        if (type !== 'tEXt' && type !== 'zTXt' && type !== 'iTXt') continue;
        const nul = data.indexOf(0);
        if (nul < 0) continue;
        const keyword = latin1.decode(data.subarray(0, nul));
        try {
            if (type === 'tEXt') {
                texts[keyword] = latin1.decode(data.subarray(nul + 1));
            } else if (type === 'zTXt') {
                texts[keyword] = latin1.decode(await inflate(data.subarray(nul + 2)));
            } else {
                // iTXt: keyword\0 compressed(1) method(1) language\0 translated keyword\0 text
                const compressed = data[nul + 1] === 1;
                const langEnd = data.indexOf(0, nul + 3);
                const transEnd = data.indexOf(0, langEnd + 1);
                if (langEnd < 0 || transEnd < 0) continue;
                const body = data.subarray(transEnd + 1);
                texts[keyword] = utf8.decode(compressed ? await inflate(body) : body);
            }
        } catch {
            /* Skip unreadable chunks; other chunks may still hold the card. */
        }
    }
    return texts;
}

function decodeBase64Json(text: string): unknown {
    const binary = atob(text.trim());
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

/** Normalize any supported card JSON to the fields SPIRE uses. */
export function normalizeCard(json: unknown): CharacterCard {
    // Chub's own export/API shape keeps the main text in definition.personality.
    const definition = field(field(json, 'node'), 'definition') ?? field(json, 'definition');
    if (definition && typeof definition === 'object') {
        return {
            name: str(field(definition, 'name')),
            description: str(field(definition, 'personality')) || str(field(definition, 'description')),
            personality: str(field(definition, 'tavern_personality')),
            scenario: str(field(definition, 'scenario')),
        };
    }
    // V2/V3 wrap the fields in "data"; V1 and Pygmalion-style cards keep them at the top level.
    const data = field(json, 'data');
    const d = data && typeof data === 'object' ? data : json;
    return {
        name: str(field(d, 'name')) || str(field(d, 'char_name')),
        description: str(field(d, 'description')) || str(field(d, 'char_persona')),
        personality: str(field(d, 'personality')),
        scenario: str(field(d, 'scenario')) || str(field(d, 'world_scenario')),
    };
}

export async function readCharacterCardFile(file: File): Promise<UploadedCard> {
    const isJson = /\.json$/i.test(file.name) || file.type === 'application/json';
    let json: unknown;
    let avatar: string | null = null;
    if (isJson) {
        try {
            json = JSON.parse(await file.text());
        } catch {
            throw new CardError(`${file.name} isn't valid JSON.`);
        }
    } else {
        const texts = await readPngText(await file.arrayBuffer()).catch(err => {
            throw err instanceof CardError ? new CardError(`${file.name}: only PNG or JSON character cards can be summoned.`) : err;
        });
        const payload = texts['ccv3'] ?? texts['chara'];
        if (!payload) throw new CardError(`${file.name} is an image with no character card data inside it.`);
        try {
            json = decodeBase64Json(payload);
        } catch {
            throw new CardError(`${file.name}'s character data is damaged and couldn't be read.`);
        }
        avatar = await downscaleImage(file);
    }
    const card = normalizeCard(json);
    if (!card.name.trim()) throw new CardError(`${file.name} doesn't name its character.`);
    if (!card.description.trim() && !card.personality.trim()) throw new CardError(`${file.name} has no character description.`);
    return { card, avatar };
}

/**
 * Turn a card into the source text SPIRE's summoning distillation expects (what Chub's search used to supply):
 * the main description, plus personality and scenario, with {{char}}/{{user}} resolved the same way.
 */
export function cardToSummonSource(card: CharacterCard): { name: string; personality: string } {
    const name = card.name.trim();
    const sections = [
        card.description.trim(),
        card.personality.trim() ? `Personality: ${card.personality.trim()}` : '',
        card.scenario.trim() ? `Original scenario: ${card.scenario.trim()}` : '',
    ].filter(Boolean);
    const text = sections.join('\n\n')
        .replace(/\{\{char\}\}|<BOT>/gi, name)
        .replace(/\{\{user\}\}|<USER>/gi, 'Individual X');
    return { name, personality: text.length > MAX_SOURCE_CHARS ? `${text.slice(0, MAX_SOURCE_CHARS)}...` : text };
}
