import type Actor from './actors/Actor';
import type { SaveType } from './Stage';

/**
 * Who accompanies the Magus from the very start of the game (stored as `save.aide.type`):
 * - 'spirit': the Spire's bound tower spirit, who knows the tower intimately and guides the Magus (the classic start).
 * - 'companion': a "fellow summoned" - another living person pulled into the Spire by the same summoning as the Magus,
 *   every bit as lost as they are. With no knowledgeable guide, the two of them have to figure the tower out together.
 *
 * Either way the character occupies the same aide slot (`save.aide.actorId`, origin 'aide'), is generated at the start
 * of a new game, and stars in the opening scene. The companion is otherwise treated as a living resident: they render
 * solid, move around the tower, can take on rooms and roles, and can use the Homeward Gate like anyone but the Magus.
 */
export type AideType = 'spirit' | 'companion';

export const TOWER_SPIRIT_LABEL = 'Tower Spirit';
export const FELLOW_SUMMONED_LABEL = 'Fellow Summoned';

export const AIDE_TYPE_OPTIONS: { type: AideType; label: string; blurb: string }[] = [
    {
        type: 'spirit',
        label: TOWER_SPIRIT_LABEL,
        blurb: 'A spirit bound to the Spire long before your arrival, who knows its workings intimately and guides you through them.',
    },
    {
        type: 'companion',
        label: FELLOW_SUMMONED_LABEL,
        blurb: 'Someone pulled through the summoning circle alongside you, just as lost as you are. No guide, no answers: you figure out the Spire together.',
    },
];

export const DEFAULT_COMPANION_NAME = 'Remy';
// Written without the name (like the spirit's default) so it still fits if the player renames the companion.
export const DEFAULT_COMPANION_DESCRIPTION =
    `Whatever the enchanted tome was searching for, it didn't drag you into the Spire alone: someone else tumbled out of the summoning circle at your side in the very same instant, every bit as lost and bewildered as you are. ` +
    `With the tower's former master long gone and no one left to explain how any of it works, the two of you are on your own - piecing the Spire together from cryptic notes, half-understood apparatus, and a great deal of trial and error (heavy on the error). ` +
    `Your fellow arrival is quick-witted, stubbornly practical, and prone to gallows humor when nervous - which, lately, is always. They cope with the impossible by poking at it until it makes sense, and are fiercely glad not to be facing it alone. ` +
    `The tower's magic may have chosen you as its Magus, but they are the only other soul who shared that first impossible day.`;

/** Saves from before this option existed have no type, and always had a tower spirit. */
export function getAideType(save: SaveType): AideType {
    return save.aide?.type === 'companion' ? 'companion' : 'spirit';
}

/** True when this game started with a fellow summoned companion instead of a tower spirit. */
export function isCompanionMode(save: SaveType): boolean {
    return getAideType(save) === 'companion';
}

/** The display title for whoever fills the aide slot in this save. */
export function getAideLabel(save: SaveType): string {
    return isCompanionMode(save) ? FELLOW_SUMMONED_LABEL : TOWER_SPIRIT_LABEL;
}

function isAide(actor: Actor | undefined, save: SaveType): boolean {
    return !!actor && !!save.aide?.actorId && save.aide.actorId === actor.id;
}

/** True if this actor is the Spire's bound tower spirit (spirit mode only). */
export function isTowerSpirit(actor: Actor | undefined, save: SaveType): boolean {
    return isAide(actor, save) && !isCompanionMode(save);
}

/** True if this actor is the Magus's fellow summoned companion (companion mode only). */
export function isCompanion(actor: Actor | undefined, save: SaveType): boolean {
    return isAide(actor, save) && isCompanionMode(save);
}
