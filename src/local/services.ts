import type { Stage } from '../Stage';
import { chatCompletion, ConnectionError, loadConnection } from './connection';
import { downscaleImage } from './images';
import { installFlushOnHide, scheduleChatStateSave, setSaveErrorHandler } from './persistence';
import { errorMessage } from './util';

/**
 * Stand-ins for the services Chub provides to a stage (stage.generator, .messenger, .storage), so the game
 * code runs unchanged on the player's device:
 * - text generation goes to the player's own AI connection;
 * - image, voice and other media generation report "unavailable" (null), which the game already treats as
 *   "keep the default", and portraits come from card art instead;
 * - the chat state (every save slot) goes to IndexedDB;
 * - uploaded files become downscaled data URLs stored inside the save.
 */

const ERROR_REPEAT_MS = 15000;

export function installLocalServices(stage: Stage): void {
    let lastError = '';
    let lastErrorAt = 0;
    const report = (message: string) => {
        // SPIRE fires many requests at once; show each distinct failure once in a while, not once per request.
        const now = Date.now();
        if (message === lastError && now - lastErrorAt < ERROR_REPEAT_MS) return;
        lastError = message;
        lastErrorAt = now;
        stage.showPriorityMessage(message, undefined, 8000);
    };

    const unavailable = async () => null;

    const generator = {
        async textGen(request: { prompt?: string; template?: string; max_tokens?: number; stop?: string[] }) {
            // Scene scripts arrive as a full prompt "template" rather than a prompt; either way, Chub would fill
            // {{messages}} with chat history (there is none here) and {{user}} with the player's name.
            const prompt = (request.template || request.prompt || '')
                .replace(/\{\{messages\}\}/g, '')
                .replace(/\{\{user\}\}/gi, stage.getSave().player.name || 'the Magus');
            try {
                const result = await chatCompletion(loadConnection(), prompt, { maxTokens: request.max_tokens, stop: request.stop });
                return { result, cost: null };
            } catch (err) {
                console.error('AI request failed:', err);
                report(err instanceof ConnectionError ? err.message : `AI request failed: ${errorMessage(err)}`);
                return null;
            }
        },
        makeImage: unavailable,
        imageToImage: unavailable,
        animateImage: unavailable,
        inpaintImage: unavailable,
        removeBackground: unavailable,
        makeVideo: unavailable,
        makeSound: unavailable,
        speak: unavailable,
        transcribe: unavailable,
        makeVoice: unavailable,
        makeMusic: unavailable,
        modelGen: unavailable,
    };

    const messenger = {
        async updateChatState(state: unknown) {
            scheduleChatStateSave(state);
            return { success: true };
        },
        // Chub posts these into the chat; there is no chat to post into locally.
        async impersonate() { return null; },
    };

    const storage = {
        set(_key: string, file: Blob) {
            const url = downscaleImage(file, 1024);
            return { forUser: async () => ({ data: [{ value: await url }] }) };
        },
    };

    setSaveErrorHandler(report);
    installFlushOnHide();
    // The stand-ins cover what SPIRE calls, not every method of Chub's service interfaces.
    stage.generator = generator as unknown as Stage['generator'];
    stage.messenger = messenger as unknown as Stage['messenger'];
    stage.storage = storage as unknown as Stage['storage'];
}
