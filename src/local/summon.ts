import Actor, { generateBaseActorImage, loadReserveActor } from '../actors/Actor';
import type { Stage } from '../Stage';
import { CardError, cardToSummonSource, readCharacterCardFile } from './cards';
import { isConnectionConfigured } from './connection';

/**
 * SPIRE Local's replacement for Chub's random summons: turn an uploaded character card into a summoning
 * candidate. The card goes through the same AI distillation as a Chub card (arrival in the Spire, stats,
 * voice, style), and its art becomes the portrait, so the candidate is ready to summon right away.
 */
export async function summonCandidateFromCard(file: File, stage: Stage): Promise<Actor> {
    if (!isConnectionConfigured()) {
        throw new CardError('Set up an AI connection first (main menu, then AI Connection).');
    }
    const { card, avatar } = await readCharacterCardFile(file);
    const source = cardToSummonSource(card);
    const actor = await loadReserveActor({ name: source.name, fullPath: '', personality: source.personality }, stage, true);
    if (!actor) {
        throw new CardError(`${source.name} couldn't be drawn through: either someone by that name is already here, or the AI's answer was unusable (try again).`);
    }
    if (avatar) {
        actor.setEmotionImageUrl('neutral', avatar);
    } else {
        await generateBaseActorImage(actor, stage); // JSON cards have no art; this gives them a placeholder portrait.
    }
    return actor;
}
