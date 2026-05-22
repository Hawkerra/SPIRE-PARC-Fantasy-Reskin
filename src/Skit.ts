import { c } from "vite/dist/node/types.d-aGj9QkWt";
import Actor, { getStatDescription, findBestNameMatch, Stat, getRole } from "./actors/Actor";
import { Emotion, EMOTION_MAPPING } from "./actors/Emotion";
import { getStatRating, Module, MODULE_TEMPLATES, STATION_STAT_PROMPTS, StationStat } from "./Module";
import { Stage } from "./Stage";
import { v4 as generateUuid } from 'uuid';

export enum SkitType {
    BEGINNING = 'BEGINNING',
    INTRO_CHARACTER = 'INTRO CHARACTER',
    VISIT_CHARACTER = 'VISIT CHARACTER',
    ROLE_ASSIGNMENT = 'ROLE ASSIGNMENT',
    FACTION_INTRODUCTION = 'FACTION INTRODUCTION',
    FACTION_INTERACTION = 'FACTION INTERACTION',
    NEW_MODULE = 'NEW MODULE',
    RANDOM_ENCOUNTER = 'RANDOM ENCOUNTER',
    ENTER_CRYO = 'ENTER CRYO',
    EXIT_CRYO = 'EXIT CRYO',
    DIRECTOR_MODULE = 'DIRECTOR MODULE',
}

export interface Outcome {
    type: 'actorStat' | 'stationStat' | 'roleChange' | 'factionChange' | 'factionReputation' | 'newModule' | 'newOutfit' | 'movement';
    actorId?: string; // Required for actorStat, roleChange, factionChange, newOutfit, and movement
    stat?: Stat | StationStat; // Required for actorStat
    amount?: number; // Required for actorStat
    role?: string; // Required for roleChange (role name or '' for None)
    factionId?: string; // Required for factionChange ('' for PARC), factionReputation, and movement (destination faction ID)
    moduleId?: string; // Required for movement (destination module ID)
    module?: { id: string; moduleName: string; roleName: string; description: string }; // Required for new module
    outfit?: { id: string; actorId: string; outfitName: string; description: string }; // Required for new outfit
}

export interface ScriptEntry {
    speakerId?: string;
    speaker: string;
    message: string;
    speechUrl: string; // URL of TTS audio
    actorEmotions?: {[key: string]: Emotion}; // actor name -> emotion string
    endScene?: boolean; // Whether this entry marks a scene end
    movements?: {[actorId: string]: string}; // actor ID -> new module ID
    outfitChanges?: {[actorId: string]: string}; // actor ID -> new outfit ID
    moveToModuleId?: string; // Optional ID of a module that the scene moves to as of this entry.
    outcomes?: Outcome[]; // Optional array of outcomes of this script entry, which can include stat changes, role/faction changes, or new modules/appearances.
}

export interface SkitData {
    id?: string;
    type: SkitType;
    moduleId: string;
    actorId?: string;
    initialActorLocations?: {[actorId: string]: string}; // Initial actor locations at the start of the skit.
    initialActorOutfits?: {[actorId: string]: string}; // Initial actor outfits at the start of the skit.
    script: ScriptEntry[];
    generating?: boolean;
    currentIndex?: number;
    context: any;
    summary?: string;
    outcomes?: Outcome[]; // Outcomes on the skit are implied results if the skit is ended after the current chunk of script. If the skit is continued or ended before the current final entry, these outcomes are discarded.

}

function splitScriptEntriesByLineBreaks(scriptEntries: ScriptEntry[]): ScriptEntry[] {
    const splitEntries: ScriptEntry[] = [];

    for (const entry of scriptEntries) {
        const messageLines = (entry.message || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (messageLines.length <= 1) {
            splitEntries.push(entry);
            continue;
        }

        splitEntries.push({
            ...entry,
            message: messageLines[0]
        });

        for (let i = 1; i < messageLines.length; i++) {
            splitEntries.push({
                speaker: entry.speaker,
                speakerId: entry.speakerId,
                message: messageLines[i],
                speechUrl: ''
            });
        }
    }

    return splitEntries;
}

export function generateSkitTypePrompt(skit: SkitData, stage: Stage, continuing: boolean): string {
    const actor = stage.getSave().actors[skit.actorId || ''];
    const module = stage.getSave().layout.getModuleById(skit.moduleId || '');
    const faction = stage.getSave().factions[skit.context.factionId || ''];
    const notHereText = 'This communication is being conducted via remote video link; no representative is physically present on the station. ';
    switch (skit.type) {
        case SkitType.BEGINNING:
            return !continuing ?
                `This scene introduces the beginning of the story, as the holographic StationAide™, ${stage.getSave().aide.name}, resurrects the player, ` +
                `${stage.getSave().player.name} from their echo chamber aboard the otherwise-abandoned PARC station ` +
                `and declares the player to be the new Director of said station. ${stage.getSave().aide.name} has been keeping the station stable but was unable to take on patients without a Director, ` +
                `so they are relieved to have someone take on the role once more and eager to get back to the business of rehabilitation. This scene must end before bringing any additional patients aboard; ` +
                `this process is handled via a separate game mechanic.` :
                `Continue this introductory scene, expanding on the initial situation and context as the holographic StationAide™, ${stage.getSave().aide.name}, ` +
                `welcomes the newly reconstituted ${stage.getSave().player.name} and names them the new Director of the otherwise-abandoned PARC. ` +
                `${stage.getSave().aide.name} should explain the PARC's core premise of bringing back characters from dead timelines and rehabilitating them. ` +
                `The holographic aide was unable to take on patients without a Director, so they are eager to get back to business, echofusing new patients and helping them find their place in this universe. ` +
                `Once the concept is established, use a "[SUMMARY]" tag to summarize the scene before moving on. This scene must end before bringing any additional patients aboard; ` +
                `this process is handled via a separate game mechanic; use the "[SUMMARY]" tag to summarize the events of this intro and end the scene before that occurs.`;
        case SkitType.INTRO_CHARACTER:
            return !continuing ? 
                `This scene will introduce a new character, ${actor.name}, fresh from their echo chamber. ${actor.name} will have no knowledge of this universe. Establish their personality and possibly some motivations.` :
                `Continue the introduction of ${actor.name}, expanding on their personality or motivations.`;
        case SkitType.VISIT_CHARACTER:
            return !continuing ?
                `This scene depicts the player's visit with ${actor.name} in ${actor.name}'s quarters, which have been redecorated to match ${actor.name}'s style (${actor.style}). Bear in mind that ${actor.name} is from another universe, and may be unaware of details of this one. ` +
                    `Potentially explore ${actor.name}'s thoughts, feelings, or troubles in this intimate setting.` :
                `Continue this scene with ${actor.name}, potentially exploring their thoughts, feelings, or troubles in this intimate setting.`;
        case SkitType.RANDOM_ENCOUNTER:
            // Create a random plot suggestion for the encounter; choose a random present character as central
            const presentCharacters = Object.values(stage.getSave().actors).filter(a => {a.locationId === skit.moduleId && !a.factionId});
            const centralCharacter = presentCharacters.length > 0 ? presentCharacters[Math.floor(Math.random() * presentCharacters.length)] : null;
            const offStationCharacters = Object.values(stage.getSave().actors).filter(a => a.isOffSite(stage.getSave()) && !a.factionId);
            const offStationCharacter = offStationCharacters.length > 0 ? offStationCharacters[Math.floor(Math.random() * offStationCharacters.length)] : null;
            const plotSuggestions = [
                // If off-station character has been gone a couple days, they could return (perhaps unexpectedly)
                (offStationCharacter ? `${offStationCharacter.name}, who has been away on assignment, might be scheduled to return now (or perhaps is returning unexpectedly early). This scene may feature discussion about their return or depict the actual moment of return.` : null),
                // If it's been a few days since 'birth' and this character has no role nd there are muliple open roles, this character may express an interestin in an unfilledd position:
                (centralCharacter && (stage.getSave().layout.getModulesWhere(module => module.ownerId === centralCharacter.id && module.type !== 'quarters').length === 0) && (stage.getSave().day - (stage.getSave().timeline?.find(event => event.skit?.actorId === centralCharacter.id && event.skit?.type === SkitType.INTRO_CHARACTER)?.day || stage.getSave().day) >= 3) ?
                    `Having been aboard the PARC for a few days now, ${centralCharacter.name} may express an interest in taking on one of the unoccupied module roles aboard the station; consider whether any of the current options make sense: ${stage.getSave().layout.getModulesWhere(module => module.type !== 'quarters' && !module.ownerId).map(module => `${module.getAttribute('role')} (${module.getAttribute('name')})`).join(', ')}. ` : null),
                // The character could express an interest in an unowned module (if there are some unowned modules)
                (centralCharacter && Object.keys(MODULE_TEMPLATES).some(moduleType => stage.getSave().layout.getModulesWhere(module => module.type === moduleType).length === 0) ?
                    `${centralCharacter.name} may express an interest in adding a module that the PARC is currently missing; consider whether any of these options make sense: ${Object.keys(MODULE_TEMPLATES).filter(moduleType => stage.getSave().layout.getModulesWhere(module => module.type === moduleType).length === 0).map(moduleType => `${MODULE_TEMPLATES[moduleType].name}`).join(', ')}. ` : null),
                // If some faction is active and friendly, maybe talk about them:
                (Object.values(stage.getSave().factions).some(faction => faction.active && faction.reputation >= 3) ?
                    `Discuss the PARC's current relationships with ${Object.values(stage.getSave().factions).find(faction => faction.active && faction.reputation >= 3)?.name || 'an active and friendly faction'}, and any potential offers or missions that might be available to patients aboard the station.` : null),
                // If some station stat is high, maybe have an event that reflects that while pushing it downward:
                (Object.values(StationStat).some(stat => (stage.getSave().stationStats?.[stat] || 3) >= 7) ?
                    `An event occurs that reflects the PARC's high ${Object.values(StationStat).find(stat => (stage.getSave().stationStats?.[stat] || 3) >= 7) || 'Systems'} stat, but also threatens to lower it.` :  '') +
                // If some station stat is low, maybe have an event that reflects that while pushing it up:
                (Object.values(StationStat).some(stat => (stage.getSave().stationStats?.[stat] || 3) <= 3) ?
                    `An event occurs that reflects the PARC's low ${Object.values(StationStat).find(stat => (stage.getSave().stationStats?.[stat] || 3) <= 3) || 'Morale'} stat, but also offers an opportunity to raise it.` :  ''),
                // If there is another patient on the PARC maybe focus on centralCharacter's relationhip or thoughts on them:
                (centralCharacter && Object.values(stage.getSave().actors).filter(actor => actor.origin === 'patient').length > 1 ?
                    `Explore ${centralCharacter.name}'s thoughts or feelings about other patients aboard the PARC, such as ${Object.values(stage.getSave().actors).filter(actor => actor.origin === 'patient' && actor.id !== centralCharacter.id).map(actor => actor.name)[0]}.` : null), 
                // Generic suggestion:
                `Explore the setting and what might arise from this unexpected meeting.`
            ].filter(s => s !== null);
            const randomSuggestion = plotSuggestions.length > 0 ? plotSuggestions[Math.floor(Math.random() * plotSuggestions.length)] : 'Explore the setting and what might arise from this unexpected meeting.';

            return !continuing ?
                `This scene depicts a chance encounter in the ${module?.getAttribute('name') || 'unknown'} module${module?.ownerId ? ` which has been redecorated to suit ${stage.getSave().actors[module.ownerId]?.name || 'its owner'}'s style (${stage.getSave().actors[module.ownerId]?.style})` : ''}. ` +
                `Bear in mind that patients are from another universe, and may be unaware of details of this one. ` +
                    randomSuggestion :
                `Continue this chance encounter in the ${module?.getAttribute('name') || 'unknown'} module. ${randomSuggestion}.`;
        case SkitType.ROLE_ASSIGNMENT:
            return !continuing ?
                `This scene depicts an exchange between the player and ${actor.name}, following the player's decision to newly assign ${actor.name} to the role of ${skit.context.role || 'something new'} in the ${module?.getAttribute('name') || 'unknown'} module. ` +
                    `Bear in mind ${actor.name}'s personality, stats, and experience within this setting (or lack thereof) as you portray their reaction and to this new role. ` :
                `Continue this scene with ${actor.name}, potentially exploring their thoughts or feelings toward their new role.`;
        case SkitType.NEW_MODULE:
            return !continuing ?
                `This scene depicts an exchange between the player and some of the patients regarding the opening of a new module, the ${module?.getAttribute('name') || 'unknown'}. ` :
                `Continue this scene, exploring the crew's thoughts or feelings toward this latest addition to the PARC.`;
        case SkitType.FACTION_INTRODUCTION:
            return (!continuing ?
                `This scene introduces a new faction that would like to do business with the Director and PARC: ${faction?.name || 'a secret organization'}. ` +
                notHereText +
                `Describe this new faction's appearance, motivations, and initial interactions with the player Director and other characters present in the Comms module (if any). ` :
                `This is an introductory scene for ${faction?.name || 'a secret organization'}. ` +
                notHereText);
        case SkitType.FACTION_INTERACTION:
            return (!continuing ?
                `This scene depicts an interaction between the Director and a faction that does business with the PARC: ${faction?.name || 'a secret organization'}. ` +
                notHereText :
                `Continue this scene between the Director and a representative for ${faction?.name || 'a secret organization'}'s. ` + 
                notHereText);
        case SkitType.ENTER_CRYO:
            return `This scene depicts the Director's decision to place ${actor.name} into cryogenic stasis in the Cryo Bank module. ` +
                `Explore ${actor.name}'s thoughts and feelings about this process, as well as any final exchanges with the player or other characters present. ` +
                `The decision will not be reversed during this skit; it is a foregone conclusion.`;
        case SkitType.EXIT_CRYO:
            return `This scene depicts the Director's decision to awaken ${actor.name} from cryogenic stasis after ${skit.context.days} days. ` +
                `Explore ${actor.name}'s thoughts and feelings about this process and their absence, as well as any initial exchanges with the player or other characters present. `;
        case SkitType.DIRECTOR_MODULE:
            return `This scene takes place in the Director's personal module. This scene could encompass all manner of interactions, from introspective moments alone to exchanges with other characters. `;
        default:
            return '';
    }
}

function buildScriptLog(skit: SkitData, additionalEntries: ScriptEntry[] = [], stage?: Stage): string {
    const formatSignedAmount = (amount?: number): string => {
        const value = amount || 0;
        return `${value >= 0 ? '+' : ''}${value}`;
    };

    const resolveActorName = (actorId?: string): string => {
        if (!actorId) return 'Unknown Character';
        if (actorId === 'player') return stage?.getSave().player.name || 'Player';
        return stage?.getSave().actors[actorId]?.name || actorId;
    };

    const resolveFactionName = (factionId?: string): string => {
        if (!factionId) return 'PARC';
        return stage?.getSave().factions[factionId]?.name || factionId;
    };

    const formatOutcomeTag = (outcome: Outcome): string | null => {
        switch (outcome.type) {
            case 'actorStat': {
                if (!outcome.stat) return null;
                return `[${resolveActorName(outcome.actorId)}: ${String(outcome.stat)} ${formatSignedAmount(outcome.amount)}]`;
            }
            case 'stationStat': {
                if (!outcome.stat) return null;
                return `[STATION: ${String(outcome.stat)} ${formatSignedAmount(outcome.amount)}]`;
            }
            case 'factionReputation': {
                return `[FACTION: ${resolveFactionName(outcome.factionId)} ${formatSignedAmount(outcome.amount)}]`;
            }
            case 'factionChange': {
                return `[${resolveActorName(outcome.actorId)}: JOINED ${resolveFactionName(outcome.factionId)}]`;
            }
            case 'roleChange': {
                const roleName = outcome.role && outcome.role.trim().length > 0 ? outcome.role : 'None';
                return `[${resolveActorName(outcome.actorId)}: ROLE ${roleName}]`;
            }
            case 'newModule': {
                if (!outcome.module?.moduleName || !outcome.module?.roleName || !outcome.module?.description) return null;
                return `[NEW MODULE: ${outcome.module.moduleName} | ROLE ${outcome.module.roleName} | DESCRIPTION ${outcome.module.description}]`;
            }
            case 'newOutfit': {
                if (!outcome.outfit?.outfitName || !outcome.outfit?.description) return null;
                return `[NEW APPEARANCE: ${resolveActorName(outcome.actorId || outcome.outfit.actorId)} | NAME ${outcome.outfit.outfitName} | DESCRIPTION ${outcome.outfit.description}]`;
            }
            default:
                return null;
        }
    };

    return ((skit.script && skit.script.length > 0) || additionalEntries.length > 0) ?
        [...skit.script, ...additionalEntries].map(e => {
            // Find the best matching emotion key for this speaker
            const speakerName = (stage?.getSave().actors[e.speakerId || '']?.name || (e.speakerId == 'player' ? stage?.getSave().player.name : '') || e.speaker || 'Unknown Speaker');
            const emotionKeys = Object.keys(e.actorEmotions || {});
            const candidates = emotionKeys.map(key => ({ name: key }));
            const bestMatch = findBestNameMatch(speakerName, candidates);
            const matchingKey = bestMatch?.name;
            const emotionText = matchingKey ? ` [${matchingKey} expresses ${e.actorEmotions?.[matchingKey]}]` : '';
            const wearsText = Object.entries(e.outfitChanges || {}).map(([actorId, outfitId]) => {
                const actor = stage?.getSave().actors?.[actorId];
                const outfit = actor?.outfits.find(o => o.id === outfitId);
                return actor && outfit ? ` [${actor.name} wears ${outfit.name}]` : '';
            }).join('');

            const messageLine = `[${speakerName} turn]${emotionText}${wearsText} ${e.message}`.trim();
            const outcomeTags = (e.outcomes || [])
                .map(formatOutcomeTag)
                .filter((tag): tag is string => !!tag);

            return outcomeTags.length > 0 ? `${messageLine}\n${outcomeTags.join('\n')}` : messageLine;
        }).join('\n')
        : '(None so far)';
}

/**
 * Resolve the current scene module ID at a point in the script.
 * @param skit - The skit data
 * @param upToIndex - Process entries up to (but not including) this index. -1 means process all.
 */
function getCurrentSceneModuleId(skit: SkitData, upToIndex: number = -1): string {
    let currentSceneModuleId = skit.moduleId;
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);

    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.moveToModuleId) {
            currentSceneModuleId = entry.moveToModuleId;
        }
    }

    return currentSceneModuleId;
}

/**
 * Helper function to determine the current set of actors present in a module at a given script index.
 * Walks through the script from the beginning, applying movement changes.
 * @param skit - The skit data
 * @param moduleId - The module to check presence in (defaults to skit.moduleId)
 * @param upToIndex - Process script entries up to (but not including) this index. -1 means process all.
 * @returns Set of actor IDs currently present in the module
 */
function getCurrentActorsInScene(skit: SkitData, moduleId?: string, upToIndex: number = -1): Set<string> {
    const targetModuleId = moduleId || getCurrentSceneModuleId(skit, upToIndex);
    // Start with initial actor locations
    const currentLocations = {...(skit.initialActorLocations || {})};
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);
    
    // Apply movements from script entries
    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.movements) {
            Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                currentLocations[actorId] = newLocationId;
            });
        }
    }
    
    // Return actors at the target module
    const presentActors = new Set<string>();
    Object.entries(currentLocations).forEach(([actorId, locationId]) => {
        if (locationId === targetModuleId) {
            presentActors.add(actorId);
        }
    });
    
    return presentActors;
}

/**
 * Build a map of actorId -> current location at a point in the script.
 */
function getCurrentActorLocations(skit: SkitData, upToIndex: number = -1): {[actorId: string]: string} {
    const currentLocations = {...(skit.initialActorLocations || {})};
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);

    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.movements) {
            Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                currentLocations[actorId] = newLocationId;
            });
        }
    }

    return currentLocations;
}

/**
 * Build a map of actorId -> current outfit at a point in the script.
 */
function getCurrentActorOutfits(skit: SkitData, stage: Stage, upToIndex: number = -1): {[actorId: string]: string} {
    const currentOutfits = {
        ...Object.values(stage.getSave().actors).reduce((acc, actor) => {
            acc[actor.id] = actor.outfitId;
            return acc;
        }, {} as {[actorId: string]: string}),
        ...(skit.initialActorOutfits || {})
    };
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);

    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.outfitChanges) {
            Object.entries(entry.outfitChanges).forEach(([actorId, outfitId]) => {
                currentOutfits[actorId] = outfitId;
            });
        }
    }

    return currentOutfits;
}

/**
 * Build a map of actorName -> current emotion at a point in the script.
 */
function getCurrentActorEmotions(skit: SkitData, upToIndex: number = -1): {[actorName: string]: Emotion} {
    // All actors start neutral; map can be initialized empty.
    const currentEmotions = {} as {[actorName: string]: Emotion};
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);
    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.actorEmotions) {
            Object.entries(entry.actorEmotions).forEach(([actorName, emotion]) => {
                currentEmotions[actorName] = emotion;
            });
        }
    }

    return currentEmotions;
}

function processSceneMovementTag(rawTag: string, stage: Stage): string | null {
    const sceneMovementRegex = /^SCENE\s+MOVES\s+to\s+(.+)$/i;
    const sceneMovementMatch = sceneMovementRegex.exec(rawTag);
    if (!sceneMovementMatch) return null;

    const destinationName = sceneMovementMatch[1].trim();
    const modules = stage.getLayout().getModulesWhere(m => !!m.getAttribute('name'));
    const modulesWithName = modules.map(m => ({
        name: `${m.getAttribute('name') || ''} ${m.type}`.trim(),
        module: m
    }));
    const targetModuleMatch = findBestNameMatch(destinationName, modulesWithName);

    if (!targetModuleMatch) {
        console.warn(`Could not find module matching scene move destination: ${destinationName}`);
        return null;
    }

    console.log(`Scene movement detected: scene moves to ${targetModuleMatch.module.getAttribute('name')} (${targetModuleMatch.module.id})`);
    return targetModuleMatch.module.id;
}

/**
 * Process an appearance tag and return actor/outfit IDs if valid.
 * Format: [Character Name wears Appearance Name]
 */
function processWearTag(rawTag: string, stage: Stage): { actorId: string; outfitId: string } | null {
    const wearRegex = /^([^[\]]+?)\s+wears\s+(.+)$/i;
    const wearMatch = wearRegex.exec(rawTag);
    if (!wearMatch) return null;

    const characterName = wearMatch[1].trim();
    const appearanceName = wearMatch[2].trim();
    const allActors: Actor[] = Object.values(stage.getSave().actors);
    const matchedActor = findBestNameMatch(characterName, allActors);

    if (!matchedActor) {
        console.warn(`Could not find actor matching wears tag character: ${characterName}`);
        return null;
    }

    const matchedOutfit = findBestNameMatch(
        appearanceName,
        matchedActor.outfits.map(outfit => ({ name: outfit.name, outfit }))
    );

    if (!matchedOutfit) {
        console.warn(`Could not find outfit matching wears tag appearance "${appearanceName}" for ${matchedActor.name}; discarding tag.`);
        return null;
    }

    return { actorId: matchedActor.id, outfitId: matchedOutfit.outfit.id };
}

/**
 * Process a movement tag and return the destination module/faction ID if valid.
 * @param rawTag - The raw tag content (without brackets)
 * @param stage - The Stage object for accessing save data and layout
 * @param skit - The current skit data
 * @returns An object with actorId and destinationId, or null if invalid
 */
function processMovementTag(rawTag: string, stage: Stage, skit: SkitData | undefined, currentSceneModuleId?: string): { actorId: string; destinationId: string } | null {
    // Look for movement tags: [Character Name moves to Module Name]
    const movementRegex = /^([^[\]]+?)\s+moves\s+to\s+(.+)$/i;
    const movementMatch = movementRegex.exec(rawTag);
    if (!movementMatch) return null;
    
    const characterName = movementMatch[1].trim();
    const destinationName = movementMatch[2].trim();
    
    // Find matching actor using findBestNameMatch
    const allActors: Actor[] = Object.values(stage.getSave().actors);
    const matched = findBestNameMatch(characterName, allActors);
    if (!matched) {
        console.warn(`Could not find actor matching: ${characterName}`);
        return null;
    }
    
    // Resolve destination module
    let destinationModuleId = '';
    
    // Check if it's a quarters reference (e.g., "Susan's quarters" or "quarters")
    const quartersMatch = /^(.+?)'s\s+quarters$/i.exec(destinationName);
    if (quartersMatch) {
        // Specific character's quarters
        const quartersOwnerName = quartersMatch[1].trim();
        const quartersOwner = findBestNameMatch(quartersOwnerName, allActors);
        if (quartersOwner) {
            // Find the quarters module owned by this actor
            const quartersModule = stage.getLayout().getModulesWhere(m => 
                m.type === 'quarters' && m.ownerId === quartersOwner.id
            )[0];
            if (quartersModule) {
                destinationModuleId = quartersModule.id;
            } else {
                console.warn(`${quartersOwner.name} has no quarters assigned`);
            }
        } else {
            console.warn(`Could not find quarters owner: ${quartersOwnerName}`);
        }
    } else if (destinationName.toLowerCase().endsWith('quarters') || ['home', 'their room', 'another module', 'elsewhere'].includes(destinationName.toLowerCase())) {
        // Character's own quarters (if they have any)
        const ownQuarters = stage.getLayout().getModulesWhere(m => 
            m.type === 'quarters' && m.ownerId === matched.id
        )[0];
        if (ownQuarters) {
            destinationModuleId = ownQuarters.id;
        } else {
            console.warn(`${matched.name} has no quarters assigned`);
        }
    } else if (destinationName.toLowerCase() === 'parc') {
        // Move to comms by default for vague "station" references
        destinationModuleId = stage.getSave().layout.getModulesWhere(module => module.type === 'comms')[0]?.id || skit?.moduleId || '';
    } else if (skit && ['here', 'this module', 'this location', 'this area', 'current module'].includes(destinationName.toLowerCase())) {
        // Move to current skit module
        destinationModuleId = currentSceneModuleId || getCurrentSceneModuleId(skit, -1) || skit.moduleId || '';
    } else {
        // Try to find a module by type name
        // Use findBestNameMatch:
        const modules = stage.getLayout().getModulesWhere(m => !!m.getAttribute('name'));
        const modulesWithName = modules.map(m => ({ name: m.getAttribute('name') || '', module: m }));
        const targetModuleMatch = findBestNameMatch(destinationName, modulesWithName);
        if (targetModuleMatch) {
            const targetModule = targetModuleMatch.module;
            destinationModuleId = targetModule.id;
            console.log(`Movement detected: ${matched.name} moves to module ${targetModule.getAttribute('name')} (${targetModule.id})`);
        } else {
            // If no module found, check if it matches a faction name using best match logic
            console.log(`No module matched for destination: ${destinationName}, checking factions.`);
            const matchingFaction = findBestNameMatch(
                destinationName,
                Object.values(stage.getSave().factions)
            );
            if (matchingFaction) {
                destinationModuleId = matchingFaction.id;
                console.log(`Movement detected: ${matched.name} leaves to faction ${matchingFaction.name} (${matchingFaction.id})`);
            } else {
                console.warn(`Could not find module or faction matching: ${destinationName}`);
            }
        }
    }
    
    // Return movement data if valid destination found
    if (destinationModuleId) {
        if (!stage.getSave().factions[destinationModuleId]) {
            // Only log for modules, not factions (already logged above)
            console.log(`Movement detected: ${matched.name} moves to ${destinationName} (${destinationModuleId})`);
        }
        return { actorId: matched.id, destinationId: destinationModuleId };
    }
    
    return null;
}

// Weird place for this because I'm using it all over.
export function buildPromptSegment(title: string, content: string) {
    return content.trim() ? `${title}: [\n${content.trim()}\n]\n\n` : '';
}

export function buildSkitPrompt(skit: SkitData, stage: Stage, historyLength: number, instruction: string): string {
    const playerName = stage.getSave().player.name;
    const save = stage.getSave();

    // Initialize skit with all actor locations if this is the first generation
    if (skit.script.length === 0) {
        skit.initialActorLocations = {};
        skit.initialActorOutfits = {};
        Object.values(save.actors).forEach(a => {
            skit.initialActorLocations![a.id] = a.locationId;
            skit.initialActorOutfits![a.id] = a.outfitId;
        });
    }

    const currentActorOutfitIds = getCurrentActorOutfits(skit, stage, -1);

    // Determine present and absent actors for this moment in the skit (as of the last entry in skit.script):
    const currentSceneModuleId = getCurrentSceneModuleId(skit, -1);
    const presentActorIds = getCurrentActorsInScene(skit, currentSceneModuleId, -1);
    const presentPatients = Object.values(save.actors).filter(a => presentActorIds.has(a.id) && !a.factionId);
    const absentPatients = Object.values(save.actors).filter(a => !presentActorIds.has(a.id) && !a.factionId && save.aide.actorId != a.id && !['cryo', 'dead'].includes(a.locationId) && !a.isOffSite(save));
    const cryoPatients = Object.values(save.actors).filter(a => a.locationId === 'cryo' && !a.factionId);
    const awayPatients = Object.values(save.actors).filter(a => !a.factionId && a.isOffSite(save));

    // Update participation counts if this is the start of the skit
    if (skit.script.length === 0) {
        // Increment participation count for present actors
        presentPatients.forEach(a => {
            a.participations = (a.participations || 0) + 1;
        });
    }

    let pastEvents = save.timeline || [];
    pastEvents = pastEvents.filter((v, index) => index > (pastEvents.length || 0) - historyLength);
    const module = save.layout.getModuleById(currentSceneModuleId || '');
    const moduleOwner = module?.ownerId ? save.actors[module.ownerId] : null;
    const faction = skit.context.factionId ? save.factions[skit.context.factionId] : null;
    const factionRepresentative = faction ? save.actors[faction.representativeId || ''] : null;
    const stationAide = save.actors[save.aide.actorId || ''];

    let fullPrompt = `{{messages}}` +
        buildPromptSegment('Premise', `This is a sci-fi visual novel game set on a space station that resurrects and rehabilitates patients who died in other universes' apocalypses: ` +
        `the Post-Apocalypse Rehabilitation Center. ` +
        `The thrust of the game positions the player character, ${playerName}, as the Director of the PARC station, interacting with patients and crew as they navigate this complex futuristic universe together. ` +
        `The PARC is an isolated station near a black hole, from which it pulls and reconstitutes the echoes of apocalypse victims. It serves as both sanctuary and containment for its diverse inhabitants, who hail from various alternate realities. ` +
        `${playerName} is the only non-patient aboard the station (although they may hire patients on as crew or staff); as a result, the station may feel a bit lonely or alienating at times. ` +
        `Much of the day-to-day maintenance and operation of the station is automated by the station's AI, ${save.aide.name || 'StationAide™'}, and various drones, enabling ${playerName} to focus on patient care and rehabilitation.`) +
        buildPromptSegment('Narrative Tone', save.tone || stage.TONE_MAP['Original']) +
        buildPromptSegment('Station Stats', save.stationStats ? (
            Object.values(StationStat).map(stat => `  ${stat} (${save.stationStats?.[stat] || 3}): ${STATION_STAT_PROMPTS[stat][getStatRating(save.stationStats?.[stat] || 3)]}`).join('\n')
        ) : '') +
        (
            // If module is a quarters, present it as "Owner's quarters" or "vacant quarters": module type otherwise.
            buildPromptSegment('Modules and Crew Roles', save.layout.getModulesWhere(module => true).map(module => module.type == 'quarters' ? 
                (module.ownerId ? `  ${save.actors[module.ownerId]?.name || 'Unknown'}'s Quarters` : '  Vacant Quarters') : 
                `  ${module.getAttribute('name')} ${module.getAttribute('role') ? `(${module.getAttribute('role')} : ${module.ownerId ? `${save.actors[module.ownerId]?.name || 'Unknown'}` : 'None'})` : ''}`).join('\n'))
        ) +
        buildPromptSegment(`${playerName}'s profile`, save.player.description) +
        (stationAide ? buildPromptSegment('StationAide™ profile', (presentActorIds.has(stationAide.id) ? `The holographic StationAide™ ${stationAide.name} is active in the scene.` : `\n\nThe holographic StationAide™ ${stationAide.name} remains absent from the scene unless summoned.`) + `\n${stationAide.profile}`) : '') +
        // List non-present characters for reference; just need description and profile:
        buildPromptSegment('Absent Characters (Available to Add)', absentPatients.map(actor => {
            // Roll name and current location
            const roleModule = stage.getLayout().getModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )[0];
            const module = save.layout.getModuleById(actor.locationId);
            const locationString = module ? (module.type === 'quarters' ? (module.ownerId === actor.id ? ' Their Quarters' : (`${save.actors[module.ownerId || ''] || 'Someone'}'s Quarters`)) : module.getAttribute('name')) : 'Unknown';
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            const otherOutfits = actor.outfits.filter(o => o.id !== currentOutfitId && o.emotionPack['neutral']);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') +
                `    Profile: ${actor.profile}\n    Role: ${roleModule?.getAttribute('role') || 'Patient'}\n    Location: ${locationString}`;
        }).join('\n')) +
        // List away characters for reference; just need description and profile:
        buildPromptSegment('Off-Station Characters (On Assignment Away from the PARC)', awayPatients.map(actor => {
            // Just role name and faction on loan to
            const roleModule = stage.getLayout().getModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )[0];
            const atFaction = save.factions[actor.locationId];
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                // (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') + // Unnecessary for absent characters
                `    Profile: ${actor.profile}\n    Role: ${roleModule?.getAttribute('role') || 'Patient'}\n    On Assignment to: ${atFaction?.name || 'Unknown Faction'}`;
        }).join('\n')) +
        
        // List cryo characters for reference; just need description and profile:
        buildPromptSegment('Cryo Frozen Characters (Absolutely Unavailable)', cryoPatients.map(actor => {
            const entranceEvent = stage.getSave().timeline?.find(event => event.skit?.actorId === actor.id && event.skit?.type === SkitType.ENTER_CRYO);
            const entranceDate = entranceEvent ? entranceEvent.day : stage.getSave().day;
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                // (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') + // Unnecessary for cryo characters
                `    Profile: ${actor.profile}\n    Days in Cryo: ${save.day - entranceDate}`;
        }).join('\n')) +

        // List stat meanings, for reference:
        buildPromptSegment('Stat Explanations', Object.values(Stat).map(stat => `${stat.toUpperCase()}: ${getStatDescription(stat)}`).join('\n')) +
        
        buildPromptSegment('Scene Prompt', `${generateSkitTypePrompt(skit, stage, skit.script.length > 0)}\n`) +
        (faction ? buildPromptSegment(`${faction.name} Details`, `${faction.name} Details: ${faction.description}\n${faction.name} Aesthetic:\n  ${faction.visualStyle}` +
            (factionRepresentative ? `\n${faction?.name || 'The faction'}'s representative, ${factionRepresentative.name}, appears on-screen. Their description: ${factionRepresentative.getDescription(currentActorOutfitIds[factionRepresentative.id] || factionRepresentative.outfitId)}` :
                'They have no designated liaison for this communication; any characters introduced during this scene will be transient.')) : '') +
        (faction ? buildPromptSegment(`${faction.name} Relationship`, `This skit may explore the nature of this faction's relationship with an intentions for the Director, the PARC, or its patients. ` +
            `Typically, this and other factions contact the PARC to express interest in making offers for resources, information, or patients. ` +
            `The faction could have a temporary job to offer a patient, or suggest an exchange of resources or favors. Or they could have a permanent role in mind for an ideal candidate patient. ` +
            `If a patient is already on-loan to this faction, use this opportunity to update the Director on their status, depict the patient's return, or convert them to a permanent placement with the faction. ` +
            `Remember to use appropriate tags when moving characters on- or off-station in the skit. `) : '') +

        buildPromptSegment(`Known Factions`, `${Object.values(stage.getSave().factions).filter(faction => faction.active && faction.reputation > 0).map(faction => `${faction.name}: ${faction.getReputationDescription()}`).join('\n  ')}`) +
        ((historyLength > 0 && pastEvents.length) ? 
                // Include last few skit scripts for context and style reference; use summary except for most recent skit or if no summary.
                buildPromptSegment('Recent Events and Skits', pastEvents.map((v, index) =>  {
                if (v.skit) {
                    const module = stage.getSave().layout.getModuleById(v.skit.moduleId || '');
                    const moduleOwner = module?.ownerId ? stage.getSave().actors[module.ownerId] : null;
                    const moduleDescription = module ? (module.type === 'quarters' && moduleOwner ? `${moduleOwner.name}'s quarters` : `the ${module.getAttribute('name')}`) : 'an unknown location';
                    return ((!v.skit.summary || index == pastEvents.length - 1) ?
                        (`\n\nScript of Scene in ${moduleDescription} (${stage.getSave().day - v.day}) days ago:\n` +
                        `${buildScriptLog(v.skit, [], stage)}`) :
                        (`\n\nSummary of scene in ${moduleDescription} (${stage.getSave().day - v.day}) days ago:\n` + v.skit.summary)
                        )
                } else {
                    return `\n\nAction ${stage.getSave().day - v.day} days ago: ${v.description || ''}`;
                }
            }).join('')) : '') +
        (module ? buildPromptSegment('Current Module', `The following scene is set in ` +
            `${module.type === 'quarters' ? `${moduleOwner ? `${moduleOwner.name}'s` : 'a vacant'} quarters` : 
            `the ${module.getAttribute('name') || 'Unknown'}`}. ${module.getAttribute('skitPrompt') || 'No description available.'}`) : '') +
        // List characters who are here, along with full stat details:
        buildPromptSegment('Present Characters (Currently in the Scene)', `${presentPatients.map(actor => {
            const roleModule = stage.getLayout().getModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )[0];
            const birthDay = save.timeline?.find(event => event.skit?.actorId === actor.id && event.skit?.type === SkitType.INTRO_CHARACTER)?.day || save.day;
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            const otherOutfits = actor.outfits.filter(o => o.id !== currentOutfitId && o.emotionPack['neutral']);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') +
                `    Profile: ${actor.profile}\n    Character Arc: ${actor.characterArc || 'Undetermined'}\n    Days Aboard: ${save.day - birthDay}\n` +
                (roleModule ? `    Role: ${roleModule.getAttribute('role') || 'Patient'} (${actor.heldRoles[roleModule.getAttribute('role') || 'Patient'] || 0} days)\n` : '') +
                `    Role Description: ${roleModule?.getAttribute('roleDescription') || 'This character has no assigned role aboard the PARC. They are to focus upon their own needs.'}\n` +
                `    Stats:\n      ${Object.entries(actor.stats).map(([stat, value]) => `${stat}: ${value}`).join(', ')}`}).join('\n')}`) +
        `\n${instruction}`;
    return fullPrompt;
}

function buildOutcomeTagRules(exampleActor: string): string {return `\n#Character Stat Changes:#\n` +
                            `Identify any changes to character stats implied by this entry. For each change, output a line in the following format:\n` +
                            `[<characterName>: <stat> +<value>(, ...)]` +
                            `Where <stat> is the name of the stat to be changed, and <value> is the amount to increase or decrease the stat by (positive or negative). ` +
                            `Multiple stat changes can be included in a single tag, separated by commas. Similarly, multiple character tags can be provided in the output.` +
                            `Full Examples:\n` +
                            `[${exampleActor}: brawn +1, charm +2]\n` +
                            `[${exampleActor}: lust -1]\n` +

                            `\n#Station Stat Changes:#\n` +
                            `Identify any changes to PARC station stats implied or indicated by each entry. Ignore lines from the entry that simply illustrate the current stats, ` +
                            `and instead focus on changes or developments in the PARC's situation or operations. For each change, output a line in the following format:\n` +
                            `[STATION: <stat> +<value>(, ...)]` +
                            `Where <stat> is the name of the station stat to be changed, and <value> is the amount to increase or decrease the stat by (positive or negative). ` +
                            `Multiple stat changes can be included in a single tag, separated by commas.` +
                            `Full Examples:\n` +
                            `[STATION: Systems +2, Comfort +1]\n` +
                            `[STATION: Security -1]\n` +

                            `\n#Faction Reputation Changes:#\n` +
                            `Identify any changes to the PARC's reputation with factions implied by each entry. For each change, output a line in the following format:\n` +
                            `[FACTION: <factionName> +<value>]\n` +
                            `Where <factionName> is the name of the faction with whom the PARC's reputation is changing, and <value> is the amount to increase or decrease the reputation by (positive or negative). ` +
                            `Reputation is a value between 1 and 10, representing the faction's opinion of the PARC, and changes are incremental. If the faction is cutting ties with the PARC, provide a large negative value. ` +
                            `Multiple faction tags can be provided in the output if, for instance, improving in the esteem of one faction inherently reduces the opinion of a rival.` +
                            `Full Examples:\n` +
                            `[FACTION: Stellar Concord +1]\n` +
                            `[FACTION: Shadow Syndicate -2]\n` +

                            `\n#Character Faction Change:#\n` +
                            `If a character has changed faction affiliations in an entry, output a line in the following format:\n` +
                            `[CHARACTER NAME: JOINED <factionName or PARC>]\n` +
                            `Where <factionName or PARC> is the name of the faction the character has joined, or "PARC" if they have left a faction to join the station itself. ` +
                            `Full Examples:\n` +
                            `[${exampleActor}: JOINED Stellar Concord]\n` +
                            `[${exampleActor}: JOINED PARC]` +
                            `\n\nThis tag indicates an official change in allegiance/affiliation/ownership/possession of the named character. ` +
                            `Consider this tag when the script depicts: ` +
                            `\n - A patient taking a permanent position with a faction.` +
                            `\n - A faction representative defecting to the PARC.` +
                            `\n - A character being formally recruited or dismissed.` +
                            `\n - A character being sold to or imprisoned by a faction.\n` +

                            `\n#Character Role Change:#\n` +
                            `If a character's role on the station changes as a result of this entry (e.g., a patient has been assigned to a staff position), output a line in the following format:\n` +
                            `[CHARACTER NAME: ROLE <roleName>]\n` +
                            `Where <roleName> is the name of the new role assigned to the character. ` +
                            `Full Example:\n` +
                            `[${exampleActor}: ROLE Liaison]\n` +
                            `[${exampleActor}: ROLE None]\n` +
                            `The role name must directly match an existing role defined by the station's current modules (or "None," if a character's role is being removed by this tag).\n` +

                            `\n#Character Movement/Departure:#\n` +
                            `If the entry depicts or implies that a character has departed the PARC or moved to a different faction (or such departure appears imminent), include final movement tags here.` +
                            `[CHARACTER NAME moves to <module name|faction name>]\n` +
                            `Full Example:\n` +
                            `[${exampleActor} moves to Stellar Concord]\n` +
                            `[${exampleActor} moves to Comms]\n` +
                            `These tags ensure that the gamestate location data reflects the scene's events; it is especially important to include movement tags for any characters leaving on or returning from missions; ` +
                            `remember that moving "to" a faction is an abstract location representing a task on that faction's behalf, whether that task is at the faction location or elsewhere entirely.` +

                            `\n#New Module Definition:#\n` +
                            `If the entry results in the conception of a new module for the station ` +
                            `(e.g., a character requests a specific new space or a new role is being established, which requires a dedicated workspace), ` +
                            `this tag is used to define the proposed module name and distinct, associated role:\n` +
                            `[NEW MODULE: <moduleName> | ROLE <roleName> | DESCRIPTION <briefDescription>]\n` +
                            `Full Example:\n` +
                            `[NEW MODULE: MedBay | ROLE Medic | DESCRIPTION A small medical bay equipped for basic treatments and check-ups.]\n` +
                            `[NEW MODULE: Lounge | ROLE Social Coordinator | DESCRIPTION A comfortable lounge area for relaxation and socialization among staff and patients.]\n` +
                            `This tag allows the game engine to create new modules dynamically based on entry events, expanding the station's capabilities and accommodating character roles as needed.\n` +

                            `\n#New Appearance Definition:#\n` +
                            `If the entry establishes a new look for a character(s) (for example, a marked physical change) or suggests the need for an alternative appearance (such as a new uniform)—which is not represented in their current "Other Appearances" list—, utilize this tag for each new look:\n` +
                            `[NEW APPEARANCE: <characterName> | NAME <appearanceName> | DESCRIPTION <physicalDescription>]\n` +
                            `Full Example:\n` +
                            `[NEW APPEARANCE: ${exampleActor} | NAME Mission Armor | DESCRIPTION Reinforced tactical plating over a dark undersuit with compact shoulder lights and weathered gloves.]\n` +
                            `The DESCRIPTION should focus on concise physical details, including intrinsic character details: body type, skin tone, hair style, eye color, etc., in addition to clothing elements and accessories.\n` +

                            `\n\n` +
                            `Tags should be a fair representation of the entry's direct or implied events. ` +
                            `Bear in mind the somewhat abstract nature of character and station stats when determining reasonable changes. ` +
                            `All stats (station and character) exist on a scale of 1-10, with 1 being the lowest and 10 being the highest possible value; ` +
                            `typically, changes should be minor (+/- 1 or 2) at a time, unless something dramatic occurs.`};

function shouldPreserveUnprocessedTag(rawTag: string): boolean {
    // Keep empty reset tags (`[]`) and single-word text style tags (e.g. `[shout]`).
    return rawTag.length === 0 || /^\w+$/.test(rawTag);
}

function stripNonStyleTags(text: string): string {
    return text.replace(/\[([^\]]*)\]/g, (fullTag, rawTag) =>
        shouldPreserveUnprocessedTag(rawTag.trim()) ? fullTag : ''
    );
}

function parseOutcomeTag(text: string, stage: Stage, skit: SkitData): Outcome[] | null {
    const allActors = Object.values(stage.getSave().actors);
    const allFactions = Object.values(stage.getSave().factions);
    const currentSceneModuleForAnalysis = getCurrentSceneModuleId(skit, -1);
    const presentActors: Actor[] = Object.values(stage.getSave().actors).filter(a => a.locationId === (currentSceneModuleForAnalysis || skit.moduleId || ''));

    if (!text) return null;

    if (text.toUpperCase().startsWith('[FACTION:')) {
        const factionTagRegex = /FACTION:\s*([^+\-]+)\s*([+\-]\s*\d+)/i;
        const factionMatch = factionTagRegex.exec(text);
        if (factionMatch) {
            console.log(`Parsing faction reputation change from tag: ${text}`);
            const factionNameRaw = factionMatch[1].trim();
            const reputationChange = parseInt(factionMatch[2].replace(/\s+/g, ''), 10) || 0;
            const matchedFaction = findBestNameMatch(factionNameRaw, allFactions);
            console.log(`Matched faction: ${matchedFaction ? matchedFaction.name : 'None'}, Reputation change: ${reputationChange}`);
            if (matchedFaction && reputationChange !== 0) {
                return [{
                    type: 'factionReputation',
                    factionId: matchedFaction.id,
                    amount: reputationChange
                }];
            }
        }
        return null;
    }

    const joinedRegex = /(.+?):\s*JOINED\s+(.+)/i;
    const joinedMatch = joinedRegex.exec(text);
    if (joinedMatch) {
        const characterNameRaw = joinedMatch[1].trim();
        const factionNameRaw = joinedMatch[2].trim();
        const matchedActor = findBestNameMatch(characterNameRaw, allActors);
        if (matchedActor) {
            let newFactionId = '';
            if (factionNameRaw.toUpperCase() !== 'PARC') {
                const matchedFaction = findBestNameMatch(factionNameRaw, allFactions);
                if (matchedFaction) {
                    newFactionId = matchedFaction.id;
                }
            }
            return [{
                type: 'factionChange',
                actorId: matchedActor.id,
                factionId: newFactionId
            }];
        }
        return null;
    }

    const roleRegex = /(.+?):\s*ROLE\s+(.+)/i;
    const roleMatch = roleRegex.exec(text);
    if (roleMatch) {
        const characterNameRaw = roleMatch[1].trim();
        const roleNameRaw = roleMatch[2].trim();
        const matchedActor = findBestNameMatch(characterNameRaw, allActors);
        const currentRole = matchedActor ? getRole(matchedActor, stage.getSave()) : null;
        const matchedRole = findBestNameMatch(roleNameRaw, stage.getSave().layout.getModulesWhere(m => true).map(m => ({ name: m.getAttribute('role') || '' })));
        const newRole = ['NONE', 'PATIENT', 'OCCUPANT'].includes(roleNameRaw.toUpperCase()) ? '' : matchedRole?.name || '';
        if (matchedActor && currentRole !== newRole) {
            return [{
                type: 'roleChange',
                actorId: matchedActor.id,
                role: newRole
            }];
        }
        return null;
    }

    if (text.toUpperCase().startsWith('[NEW MODULE:')) {
        const newModuleRegex = /NEW MODULE:\s*([^|]+)\|\s*ROLE\s+([^|]+)\|\s*DESCRIPTION\s+(.+)/i;
        const newModuleMatch = newModuleRegex.exec(text);
        if (newModuleMatch) {
            const moduleName = newModuleMatch[1].trim();
            const roleName = newModuleMatch[2].trim();
            const description = newModuleMatch[3].trim();
            if (moduleName && roleName && description) {
                const existingModules = Object.values(MODULE_TEMPLATES).map(m => ({ name: m.name }));
                const similarModule = findBestNameMatch(moduleName, existingModules);
                if (!similarModule && !findBestNameMatch(roleName, [{ name: 'NONE' }, { name: 'NOT APPLICABLE' }, { name: 'N/A' }, ...Object.values(MODULE_TEMPLATES).map(m => ({ name: m.role || 'NOT APPLICABLE' }))])) {
                    return [{
                        type: 'newModule',
                        module: {
                            id: generateUuid(),
                            moduleName,
                            roleName,
                            description
                        }
                    }];
                }
            }
        }
        return null;
    }

    if (text.toUpperCase().startsWith('[NEW APPEARANCE:')) {
        const newAppearanceRegex = /NEW APPEARANCE:\s*([^|]+)\|\s*NAME\s+([^|]+)\|\s*DESCRIPTION\s+(.+)/i;
        const newAppearanceMatch = newAppearanceRegex.exec(text);
        if (newAppearanceMatch) {
            const characterName = newAppearanceMatch[1].trim();
            const appearanceName = newAppearanceMatch[2].trim();
            const appearanceDescription = newAppearanceMatch[3].trim();
            const matchedActor = findBestNameMatch(characterName, allActors);
            if (matchedActor) {
                const similarOutfit = findBestNameMatch(
                    appearanceName,
                    matchedActor.outfits.map(outfit => ({ name: outfit.name, outfit }))
                );
                if (!similarOutfit) {
                    return [{
                        type: 'newOutfit',
                        actorId: matchedActor.id,
                        outfit: {
                            id: generateUuid(),
                            actorId: matchedActor.id,
                            outfitName: appearanceName,
                            description: appearanceDescription
                        }
                    }];
                }
            }
        }
        return null;
    }

    const statChangeRegex = /(.+?):\s*(.+)/i;
    const statMatch = statChangeRegex.exec(text);
    if (statMatch) {

        const target = statMatch[1].trim();
        const payload = statMatch[2].trim();
        const adjustments = payload.split(',').map(p => p.trim());

        if (target.toUpperCase() === 'STATION') {
            const outcomes: Outcome[] = [];
            for (const adj of adjustments) {
                const m = adj.match(/([A-Za-z\s]+)\s*([+-]\s*\d+)/i);
                if (!m) continue;
                const statNameRaw = m[1].trim();
                const num = parseInt(m[2].replace(/\s+/g, ''), 10) || 0;
                let statKey = statNameRaw.toLowerCase().trim();
                const enumMatch = Object.values(StationStat).find(s => s.toLowerCase() === statKey || s.toLowerCase().includes(statKey) || statKey.includes(s.toLowerCase()));
                if (!enumMatch) continue;
                statKey = enumMatch;
                outcomes.push({
                    type: 'stationStat',
                    stat: statKey as StationStat,
                    amount: num
                });
            }
            return outcomes.length > 0 ? outcomes : null;
        }

        const matchedActor = findBestNameMatch(target, presentActors);
        if (!matchedActor) return null;
        const outcomes: Outcome[] = [];
        for (const adj of adjustments) {
            const m = adj.match(/([A-Za-z\s]+)\s*([+-]\s*\d+)/i);
            if (!m) continue;
            const statNameRaw = m[1].trim();
            const num = parseInt(m[2].replace(/\s+/g, ''), 10) || 0;
            let statKey = statNameRaw.toLowerCase().trim();
            const enumMatch = Object.values(Stat).find(s => s.toLowerCase() === statKey || s.toLowerCase().includes(statKey) || statKey.includes(s.toLowerCase()));
            if (!enumMatch) continue;
            statKey = enumMatch;
            outcomes.push({
                type: 'actorStat',
                actorId: matchedActor.id,
                stat: statKey as Stat,
                amount: num
            });
        }
        return outcomes.length > 0 ? outcomes : null;
    }

    // Parse a moves to tag.
    const props = processMovementTag(text, stage, skit);
    if (props) {
        // props.destination could be a faction or a module; need to put it into the Outcome the right way:

        return [{
            type: 'movement',
            actorId: props.actorId,
            factionId: stage.getSave().factions[props.destinationId] ? props.destinationId : undefined,
            moduleId: stage.getSave().layout.getModuleById(props.destinationId) ? props.destinationId : undefined
        }];
    }
    
    return null;
}

function parseOutcomeTagsFromText(text: string, stage: Stage, skit: SkitData): Outcome[] {
    const outcomes: Outcome[] = [];
    console.log('Parsing outcome tags from text:', text);
 
    for (const tag of text.match(/\[[^\]]+\]/g) || []) {
        const raw = tag.slice(1, -1).trim();
        console.log(`Found tag: ${tag}`);
        if (raw) {
            const parsed = parseOutcomeTag(raw, stage, skit);
            if (parsed) {
                console.log('Parsed outcome:', parsed);
                outcomes.push(...parsed);
            }
        }
    }

    return outcomes;
}

async function generateImpliedOutcomesForCurrentEnd(skit: SkitData, newEntries: ScriptEntry[], stage: Stage): Promise<Outcome[]> {
    const analysisSkit: SkitData = {
        ...skit,
        script: [...skit.script, ...newEntries]
    };

    let retries = 3

    while (retries > 0) {
        try {
            const impliedOutcomePrompt = buildSkitPrompt(analysisSkit, stage, 0,
                buildPromptSegment('Scene Script for Analysis', buildScriptLog(analysisSkit, [], stage)) +
                buildPromptSegment('Outcome Tag Rules',
                    buildOutcomeTagRules('Some Character')) +
                buildPromptSegment('Instruction',
                    `Analyze the scene depicting in the above script. ` +
                    `Apply the Outcome Tag Rules to output outcome tags that represent the direct or implied consequences of this scene if it were to end at this moment. ` +
                    `Bear in mind existing outcome tags within the skit, avoiding redundancy or overkill. ` +
                    `When all relevant tags have been output, output an [END] tag before offering explanations for the chosen tags` +
                    `If no outcomes seem relevant, output [NO OUTCOMES].`)
                );

            const impliedResponse = await stage.makeText({
                prompt: impliedOutcomePrompt,
                min_tokens: 1,
                max_tokens: 500,
                include_history: true,
                stop: ['[END]', 'OUTCOMES]'] // Just OUTCOMES] will allow some content, so the null check doesn't retry.
            });

            if (!impliedResponse) {
                retries--;
                console.log('No implied outcomes for skit.');
                continue;
            }
            const outcomes = parseOutcomeTagsFromText(impliedResponse, stage, analysisSkit);
            console.log('Parsed outcomes:', outcomes);
            return outcomes;
        } catch(error) {
            console.error('Error generating implied outcomes:', error);
            retries--;
        }
    }

    return [];
}

export async function generateSkitSummary(skit: SkitData, stage: Stage): Promise<string> {
    const summaryPrompt = buildSkitPrompt(skit, stage, 0,
            buildPromptSegment('Scene Script for Analysis', buildScriptLog(skit, skit.script, stage)) +
            buildPromptSegment('Instruction', `Analyze the preceding scene script output a "[SUMMARY: <textSummary>]" tag with a brief summary of the entire scene's key events or outcomes.`)) +
        buildPromptSegment('Example Response',
            `[SUMMARY: A faction representative visits the PARC to make an offer to a patient, which they accept, leading to the patient's departure from the station to join that faction permanently.]`);
     let endResponse = await stage.makeText({
        prompt: summaryPrompt,
        min_tokens: 1,
        max_tokens: 300,
        include_history: true,
        stop: ['#END']
    });
    if (endResponse) {
        const summaryMatch = /\[SUMMARY:\s*([^\]]+)\]/i.exec(endResponse);
        skit.summary = summaryMatch ? summaryMatch[1].trim() : '';
        console.log('New summary for skit:', skit.summary);
        return skit.summary;
    }
    return '';
}

export async function generateSkitScript(skit: SkitData, stage: Stage): Promise<ScriptEntry[]> {

    const generalAlternativePrompts = [
        'Write compelling, fresh content that emphasizes dialogue and character interactions with suitable wit and flavor without recycling past material.',
        'Craft engaging and dynamic beats that highlight character dynamics and emotions while dodging redundant content.',
        'Eschew reliance on past themes by creating vivid and distinct moments that showcase character personalities through their actions and dialogue.',
        'Take care to avoid repetition of past events, instead focusing on advancing the scene with new developments and novel interactions.'
    ];
    const alternativePrompt = generalAlternativePrompts[Math.floor(Math.random() * generalAlternativePrompts.length)];

    // Retry logic if response is null or response.result is empty
    let retries = 3;
    while (retries > 0) {
        try {
            const fullPrompt = buildSkitPrompt(skit, stage, 5 + retries * 5, // Start with lots of history, reducing each iteration.
                buildPromptSegment(`Demonstrative Script and Tag Formatting`, 
                    `[SOME CHARACTER turn] Some Character does some actions in prose; for example, they may be waving to you, the player. They say, "My dialogue is in quotation marks."\n` +
                    `[SOME CHARACTER turn][SOME CHARACTER expresses PRIDE] They add, "A character can have two consecutive entries, if they have more to say or do, and it makes sense to break up a lot of activity."\n` +
                    `[ANOTHER CHARACTER turn][ANOTHER CHARACTER moves to HERE][ANOTHER CHARACTER expresses JOY][SOME CHARACTER expresses SURPRISE] ` +
                        `Changing speakers requires a new [<NAME> turn] tag; this tag demarkates a new entry in the script. Another Character explains, "Some Character changed their expression in this entry to react to my presence, but only I can speak here."\n` +
                    `[SOME CHARACTER turn] They nod in agreement, "If there's any dialogue at all, the entry must be attributed to the character speaking."\n` +
                    `[NARRATOR turn][SOME CHARACTER expresses RELIEF] Descriptive content or other scene events occurring around you, the player, can be attributed to NARRATOR. Dialogue cannot be included in NARRATOR entries.\n` +
                    (stage.getSave().disableImpersonation ? '' : `[${stage.getSave().player.name.toUpperCase()} turn] "Hey, Some Character," I greet them warmly. I'm the player, and my entries use first-person narrative voice, while all other skit entries use second-person to refer to me.\n`) +
                    `[NARRATOR turn][SOME CHARACTER moves to OTHER MODULE NAME] Some Character ducks out with a smile. You hear their boots fade away down the corridor beyond.\n` +
                    `[ANOTHER CHARACTER turn][SCENE moves to OTHER MODULE NAME][SOME CHARACTER wears FORMAL WEAR] You and Another Character follow Some Character to the other module, where they have changed into more formal attire. "[shout]We'll miss you, Some Character![]" cries Another Character, utilizing a text style tag.\n` +
                    `[SOME CHARACTER turn][SOME CHARACTER moves to FACTION NAME] Some Character waves good-bye as they step beyond the bulkhead, leaving the PARC to join Faction Name. You watch on-screen as their shuttle detaches from the station and disappears into the stars.` +
                    `Your dataslate pings as Faction Name's payment hits your account.[STATION: Wealth +1]\n`
                 ) +
                buildPromptSegment(`Ongoing Scene Log`, buildScriptLog(skit, [], stage)) +
                buildPromptSegment(`Primary Instruction`, 
                `${skit.script.length == 0 ? 'Produce the initial moments of a scene (perhaps joined in medias res)' : 'Extend or conclude the current scene script'} with three to five entries, ` +
                `based upon the Premise and the specified Scene Prompt. Primarily involve the Present Characters, although Absent Characters may be moved to this location using appropriate tags, if warranted. ` +
                `The script should tacitly consider characters' stats, relationships, past events, and the station's stats—among other factors—to craft a compelling scene. ` +
                `\n\nFollow the structure of the strict Example Script formatting above: ` +
                `actions are depicted in prose and character dialogue in quotation marks. Characters present their own actions and dialogue, while other events within the scene are attributed to NARRATOR. ` +
                `Although a loose script format is employed, the actual content should be professionally edited narrative prose. ` +
                (stage.getSave().disableImpersonation ? 
                    `New entries refer to the player, ${stage.getSave().player.name}, in second-person; all other characters are referred to in third-person, even in their own entries.` :
                    `Entries from the player, ${stage.getSave().player.name}, are written in first-person, while other entries consistently refer to ${stage.getSave().player.name} in second-person; all other characters are referred to in third-person, even in their own entries.`)) +
                buildPromptSegment(`Scene Cue Tags`, 
                    `Embedded within this script, you may employ these special cue tags to trigger desired behaviors in the game engine. ` +
                    `\n\n#Turn Tag:#\n` +
                        `A character turn tag must be used to initiate a new script entry. Use NARRATOR for general narration entries, or the specific character who is speaking or performing actions in this entry. Consecutive turns are preferred over long turns.\n` +
                        `[<characterName> turn]who is speaking or performing an action.` +
                    `\n\n#Emotion Tag:#\n` +
                        `Emotion tags should be used to indicate visible emotional shifts in a character's appearance using a single-word emotion name.\n` +
                        `[<characterName> expresses <emotion>]` +
                    `\n\n#Wears Tag:#\n` +
                        `Wears tags should be used when a character changes outfit or appearance. ` +
                        `When establishing a character at the beginning of a scene or when moving to this location with a movement tag, ` +
                        `give special consideration to the inclusion of a 'wears' tag to explicitly call out an appropriate look. ` +
                        `<appearanceName> must be found under the specified character—either their current appearance or one of their listed alternatives.\n` +
                        `[<characterName> wears <appearanceName>]` +
                    `\n\n#Movement Tag:#\n` +
                        `A character movement tag must be used when an Absent Character enters the scene, a present character leaves or moves to a different module on the station, ` +
                        `or when a character moves to another faction, abstractly representing any faction mission or time away. ` +
                        `If "Scene" is used as the character name, it indicates that the scene itself is moving to a different location, and all present characters are moving with it.\n` +
                        `[<characterName|"Scene"> moves to <locationName|factionName|"Here"|"Another module">]` +
                    `\n\n#Text Style Tags:#\n` +
                        `Special style keywords can be included in a tag to indicate that the surrounded text should be styled in a particular way, such as shouting or whispering.\n` +
                        `The game engine will style recognized tags appropriately. An empty tag can be used to reset the text style to default. All known styles:\n` +
                        `shout - Text is emphasized with a bold, larger font and a bright color, conveying loudness or intensity.\n` +
                        `whisper - Text is displayed in a smaller, italicized font with a muted color, suggesting secrecy or softness.\n` +
                        `quake - Text shakes or vibrates on the screen, indicating fear, shock, or instability.\n` +
                        `zalgo - Text is accented with archaic symbols and corrupted effects, often used for horror or arcana.\n` +
                        `burning - Text appears to smolder with fiery colors and flickering effects, conveying heat or destruction.\n` +
                        `tearful - Text is styled with a watery effect and soft colors, evoking sadness or emotional vulnerability.\n` +
                        `spooky - Text bounces slowly in a wave patter, good for moments of suspense, eeriness, or simply awe.\n` +
                        `glitch - Text is intermittently obscured by digital distortion and static effects, ideal for technological malfunctions or cyberpunk text.\n` +
                        `[styleName]Text to be styled[]` +
                    `\n\n#End Tag:#\n` +
                        `An end tag should be used if the new chunk of script hits a conclusory moment, where continuing makes little sense.\n` +
                        `[END]` +
                    `\n\n#Cue Notes:#\n` +
                    `For all Character movement tags, LOCATION should be the name of an existing module type (e.g., 'comms', 'infirmary', 'lounge'), a character's quarters (e.g., 'Susan's quarters' or just 'quarters' for their own), or simply "Here" to move to the scene's location or "Another module" to leave this area. ` +
                    `If a faction name is used for the LOCATION, it indicates that the character is departing from the PARC itself, typically to visit a faction or engage in a mission or job on that faction's behalf (use the faction name as the location, even when the job is not "at" the faction). ` +
                    `The game engine relies upon movement tags to update character locations and visually display character presence in scenes, so it is essential to use these tags when Absent Characters enter the scene, Present Characters leave, or the scene itself relocates. ` +
                    `These tags are not presented to users, so the narrative content of the script should also organically mention characters entering, exiting, or relocating. `
                ) +
                
                buildPromptSegment(`Outcome Tags`, 
                            `In addition to the cue tags above, you may embed outcome tags to indicate important or relevant rewards or penalties, reflecting the narrative content; ` +
                            `typically, these are included at the tail end of the turn that triggers them. Weigh other outcome tags in the scene's script to avoid redundancy or overkill. ` +
                            `For each entry, consider and output particularly suitable tags, avoiding redundant or unnecessary tags. ` + buildOutcomeTagRules('Some Character')
                ) +


                buildPromptSegment(`Current Instruction`, 
                `The System will now craft and output multiple narrative entries/turns, developing this scene for a visual novel, utilizing tags per example and historic formatting and obeying the rules above. ` +
                `This is a skit in a video game, so avoid major developments or concrete details which would fundamentally alter or subvert the mechanics of the game. ` +
                (skit.script.length == 0 ? 'As this is the initial, establishing moment of a new scene, evaluate the current appearance and alternative appearances of each character and use Appearance ("wears") tags to update the characters to the most appropriate outfit for the moment. ' : '') +
                `Generally, focus upon interpersonal dynamics, character growth, faction and patient relationships, and the Station's state, capabilities, and inhabitants. ` +
                `Ensure that the nature and writing of the scene suit the current Narrative Tone suggested above. ` +
                `\n\n${alternativePrompt}` +
                ((stage.getSave().language || 'English').toLowerCase() !== 'english' ? `\n\nNote: The game is now being played in ${stage.getSave().language}. Regardless of historic language use, generate this skit content in ${stage.getSave().language} accordingly. Special emotion, appearance, and movement tags continue to use English (these are invisible to the user).` : '') +
                ``)
            );

            const response = await stage.makeText({
                template: fullPrompt,
                min_tokens: 10,
                max_tokens: 800,
                include_history: true,
                stop: ["[END]"]
            });
            if (response && response.trim().length > 0) {
                // First, detect and parse any tags that may be embedded in the response.
                let text = response;

                // Remove everything up to the first [NAME turn] tag, if it exists, to allow for some flexibility in model output while still ensuring we start parsing from the first turn.
                const firstTurnIndex = text.search(/\[[^\]]+ turn\]/i);
                if (firstTurnIndex >= 0) {
                    text = text.slice(firstTurnIndex);
                } else {
                    console.warn('No turn tags found in response; unable to parse script entries. Response was:', response);
                    continue;
                }

                // Parse response based on turn tags, e.g. "[NAME turn] content".
                // Keep a backward-compatible fallback for legacy "NAME: content" lines.
                const lines = text.split('\n');
                const combinedEntries: { speaker: string; message: string }[] = [];
                const combinedTagData: {emotions: {[key: string]: Emotion}, movements: {[actorId: string]: string}, outfitChanges: {[actorId: string]: string}, moveToModuleId?: string, outcomes: Outcome[], endScene: boolean}[] = [];
                let currentSpeaker = 'NARRATOR';
                let currentMessage = '';
                let hasCurrentEntry = false;
                let currentEmotionTags: {[key: string]: Emotion} = {};
                let currentMovements: {[actorId: string]: string} = {};
                let currentOutfitChanges: {[actorId: string]: string} = {};
                let currentSceneMoveToModuleId: string | undefined;
                let currentOutcomes: Outcome[] = [];

                let parsedSceneModuleId = getCurrentSceneModuleId(skit, -1);
                const parsedCurrentLocations = getCurrentActorLocations(skit, -1);
                const parsedCurrentOutfits = getCurrentActorOutfits(skit, stage, -1);
                const parsedCurrentEmotions = getCurrentActorEmotions(skit, -1);
                for (const line of lines) {
                    // Skip empty lines
                    let trimmed = line.trim().replace(/[“”]/g, '"').replace(/[‘’]/g, '\'');

                    console.log(`Process line: ${trimmed}`);

                    // If a line doesn't end with ], ., !, ?, or ", then it's likely incomplete and we should drop it.
                    if (!trimmed || ![']', '*', '_', ')', '.', '!', '?', '"', '\''].some(end => trimmed.endsWith(end))) continue;

                    const newEmotionTags: {[key: string]: Emotion} = {};
                    const newMovements: {[actorId: string]: string} = {};
                    const newOutfitChanges: {[actorId: string]: string} = {};
                    const newOutcomes: Outcome[] = [];
                    let newSceneMoveToModuleId: string | undefined;

                    // Prepare list of all actors (not just present)
                    const allActors: Actor[] = Object.values(stage.getSave().actors);
                    
                    // Process tags in the line
                    for (const tag of trimmed.match(/\[[^\]]+\]/g) || []) {
                        const raw = tag.slice(1, -1).trim();
                        if (!raw) continue;

                        console.log(`Processing tag: ${raw}`);
                        
                        const sceneMoveModuleId = processSceneMovementTag(raw, stage);
                        if (sceneMoveModuleId) {
                            // Move every actor currently present in the active scene module.
                            Object.entries(parsedCurrentLocations).forEach(([actorId, locationId]) => {
                                if (locationId === parsedSceneModuleId) {
                                    newMovements[actorId] = sceneMoveModuleId;
                                }
                            });
                            newSceneMoveToModuleId = sceneMoveModuleId;
                            Object.keys(newMovements).forEach(actorId => {
                                parsedCurrentLocations[actorId] = sceneMoveModuleId;
                            });
                            parsedSceneModuleId = sceneMoveModuleId;
                            continue;
                        }

                        // Process movement tags using the shared function
                        const movementResult = processMovementTag(raw, stage, skit, parsedSceneModuleId);
                        if (movementResult && movementResult.destinationId !== parsedCurrentLocations[movementResult.actorId]) {
                            newMovements[movementResult.actorId] = movementResult.destinationId;
                            parsedCurrentLocations[movementResult.actorId] = movementResult.destinationId;
                            continue;
                        }

                        const wearResult = processWearTag(raw, stage);
                        if (wearResult && wearResult.outfitId !== parsedCurrentOutfits[wearResult.actorId]) {
                            newOutfitChanges[wearResult.actorId] = wearResult.outfitId;
                            parsedCurrentOutfits[wearResult.actorId] = wearResult.outfitId;
                            console.log(`Processed wear tag for ${wearResult.actorId}: ${wearResult.outfitId}`);
                            continue;
                        }
                        
                        // Look for expresses tags:
                        const emotionTagRegex = /([^[\]]+)\s+expresses\s+([^[\]]+)/gi;
                        let emotionMatch = emotionTagRegex.exec(raw);
                        if (emotionMatch) {
                            const characterName = emotionMatch[1].trim();
                            const emotionName = emotionMatch[2].trim().toLowerCase();
                            // Find matching actor using findBestNameMatch
                            const matched = findBestNameMatch(characterName, allActors);
                            if (!matched) continue;

                            // Try to map emotion using EMOTION_SYNONYMS if not a standard emotion
                            let finalEmotion: Emotion | undefined;
                            if (emotionName in Emotion) {
                                finalEmotion = emotionName as Emotion;
                                console.log(`Recognized standard emotion "${finalEmotion}" for ${matched.name}`);
                            } else {
                                const closestEmotion = findBestNameMatch(emotionName, Object.keys(EMOTION_MAPPING).map(e => ({ name: e })));
                                if (closestEmotion) {
                                    console.log(`Emotion "${emotionName}" for ${matched.name} mapped to emotion "${EMOTION_MAPPING[closestEmotion.name]}".`);
                                    finalEmotion = EMOTION_MAPPING[closestEmotion.name];
                                } else {
                                    console.warn(`Unrecognized emotion "${emotionName}" for ${matched.name} and no close match found; skipping tag.`);
                                }
                            }
                            
                            if (!finalEmotion || finalEmotion === parsedCurrentEmotions[matched.name]) continue;
                            newEmotionTags[matched.name] = finalEmotion;
                            parsedCurrentEmotions[matched.name] = finalEmotion;
                        }



                        // Outcome tags:
                        const maybeOutcomes = parseOutcomeTag(tag, stage, skit);
                        if (maybeOutcomes) {
                            newOutcomes.push(...maybeOutcomes);
                            continue;
                        }
                    }

                    const tagsInLine = trimmed.match(/\[[^\]]+\]/g) || [];
                    const turnTagRegex = /^(.+?)\s+turn$/i;
                    const turnTag = tagsInLine
                        .map(tag => tag.slice(1, -1).trim())
                        .find(raw => turnTagRegex.test(raw));
                    const turnMatch = turnTag ? turnTagRegex.exec(turnTag) : null;

                    // Strip parsed/non-style tags but preserve text style tags and reset tags.
                    trimmed = stripNonStyleTags(trimmed).trim();

                    const startsNewEntry = !!turnMatch;

                    if (startsNewEntry) {
                        if (hasCurrentEntry) {
                            combinedEntries.push({ speaker: currentSpeaker, message: currentMessage.trim() });
                            combinedTagData.push({
                                emotions: currentEmotionTags,
                                movements: currentMovements,
                                outfitChanges: currentOutfitChanges,
                                moveToModuleId: currentSceneMoveToModuleId,
                                outcomes: currentOutcomes,
                                endScene: false // Not currently used.
                            });
                        }

                        currentSpeaker = turnMatch ? turnMatch[1].trim() : 'NARRATOR';
                        currentMessage = turnMatch ? trimmed : '';
                        hasCurrentEntry = true;
                        currentEmotionTags = newEmotionTags;
                        currentMovements = newMovements;
                        currentOutfitChanges = newOutfitChanges;
                        currentSceneMoveToModuleId = newSceneMoveToModuleId;
                        currentOutcomes = newOutcomes;
                    } else if (hasCurrentEntry) {
                        // Continuation of previous entry
                        if (trimmed) {
                            currentMessage += (currentMessage ? '\n' : '') + trimmed;
                        }
                        currentEmotionTags = {...currentEmotionTags, ...newEmotionTags};
                        currentMovements = {...currentMovements, ...newMovements};
                        currentOutfitChanges = {...currentOutfitChanges, ...newOutfitChanges};
                        currentSceneMoveToModuleId = newSceneMoveToModuleId || currentSceneMoveToModuleId;
                        currentOutcomes = [...currentOutcomes, ...newOutcomes];
                    } else if (trimmed) {
                        // If content appears before any explicit turn tag, attribute it to NARRATOR.
                        currentSpeaker = 'NARRATOR';
                        currentMessage = trimmed;
                        hasCurrentEntry = true;
                        currentEmotionTags = newEmotionTags;
                        currentMovements = newMovements;
                        currentOutfitChanges = newOutfitChanges;
                        currentSceneMoveToModuleId = newSceneMoveToModuleId;
                        currentOutcomes = newOutcomes;
                    }
                }
                if (hasCurrentEntry) {
                    combinedEntries.push({ speaker: currentSpeaker, message: currentMessage.trim() });
                    combinedTagData.push({
                        emotions: currentEmotionTags,
                        movements: currentMovements,
                        outfitChanges: currentOutfitChanges,
                        moveToModuleId: currentSceneMoveToModuleId,
                        outcomes: currentOutcomes,
                        endScene: false // Not currently used.
                    });
                }

                // Convert parsed entries into ScriptEntry objects.
                const scriptEntries: ScriptEntry[] = combinedEntries.map((parsedEntry, index) => {
                    let speaker = parsedEntry.speaker || 'NARRATOR';
                    let message = parsedEntry.message || '';
                    
                    // Keep single-word style tags and empty reset tags in final text.
                    message = stripNonStyleTags(message).trim();
                    
                    const entry: ScriptEntry = { speaker, message, speechUrl: '' };
                    const tagData = combinedTagData[index];
                    
                    if (tagData.emotions && Object.keys(tagData.emotions).length > 0) {
                        entry.actorEmotions = tagData.emotions;
                    }
                    if (tagData.movements && Object.keys(tagData.movements).length > 0) {
                        entry.movements = tagData.movements;
                    }
                    if (tagData.outfitChanges && Object.keys(tagData.outfitChanges).length > 0) {
                        entry.outfitChanges = tagData.outfitChanges;
                    }
                    if (tagData.moveToModuleId) {
                        entry.moveToModuleId = tagData.moveToModuleId;
                    }
                    if (tagData.outcomes && tagData.outcomes.length > 0) {
                        entry.outcomes = tagData.outcomes;
                    }
                    if (tagData.endScene) {
                        entry.endScene = true;
                    }
                    return entry;
                });

                // Drop empty entries from scriptEntries and adjust speaker to any matching actor's name:
                for (const entry of scriptEntries) {
                    if (!entry.message || entry.message.trim().length === 0) {
                        const movements = entry.movements || {};
                        const emotions = entry.actorEmotions || {};
                        const outfitChanges = entry.outfitChanges || {};
                        const nextEntry = scriptEntries[scriptEntries.indexOf(entry) + 1];
                        if (nextEntry) {
                            nextEntry.movements = {...(nextEntry.movements || {}), ...movements};
                            nextEntry.actorEmotions = {...(nextEntry.actorEmotions || {}), ...emotions};
                            nextEntry.outfitChanges = {...(nextEntry.outfitChanges || {}), ...outfitChanges};
                            nextEntry.outcomes = [...(nextEntry.outcomes || []), ...(entry.outcomes || [])];
                            nextEntry.endScene = !!(nextEntry.endScene || entry.endScene);
                        }
                        scriptEntries.splice(scriptEntries.indexOf(entry), 1);
                        continue;
                    }
                    // Adjust speaker name to match actor name if possible
                    const matched = findBestNameMatch(entry.speaker, [...Object.values(stage.getSave().actors), {name: stage.getSave().player.name, id: 'player'}]); // Include player as a possible match
                    if (matched) {
                        entry.speakerId = matched.id;
                        entry.speaker = matched.name;
                    }
                }

                if (stage.getSave().disableImpersonation) {
                    // If impersonation is undesired, find any entry where the speaker matches the player's name and drop all messages beyond that point.
                    const playerEntryIndex = scriptEntries.findIndex(entry => entry.speaker.toLowerCase() === stage.getSave().player.name.toLowerCase());
                    if (playerEntryIndex !== -1) {
                        console.log(`Player entry found at index ${playerEntryIndex}. Removing all subsequent entries to disable impersonation.`);
                        scriptEntries.splice(playerEntryIndex);
                    }
                }

                const normalizedScriptEntries = splitScriptEntriesByLineBreaks(scriptEntries);


                // Run implied-outcome analysis in parallel with TTS generation.
                const impliedOutcomesPromise = generateImpliedOutcomesForCurrentEnd(skit, normalizedScriptEntries, stage);

                // TTS for each entry's dialogue
                const ttsPromises = normalizedScriptEntries.map(async (entry) => {
                    const actor = findBestNameMatch(entry.speaker, Object.values(stage.getSave().actors));
                    // Only TTS if entry.speaker matches an actor from stage().getSave().actors and entry.message includes dialogue in quotes.
                    if (!actor || !entry.message.includes('"') || stage.getSave().disableTextToSpeech) {
                        entry.speechUrl = '';
                        return;
                    }
                    let transcript = entry.message.split('"').filter((_, i) => i % 2 === 1).join('.........').trim();
                    // Strip asterisks or other markdown-like emphasis characters
                    transcript = transcript.replace(/[\*_~`]+/g, '');
                    try {
                        const ttsResponse = await stage.generator.speak({
                            transcript: transcript,
                            voice_id: actor.voiceId ?? undefined
                        });
                        if (ttsResponse && ttsResponse.url) {
                            entry.speechUrl = ttsResponse.url;
                        } else {
                            entry.speechUrl = '';
                        }
                    } catch (err) {
                        console.error('Error generating TTS:', err);
                        entry.speechUrl = '';
                    }
                });

                // Wait for both TTS and implied outcomes.
                const [, impliedOutcomes] = await Promise.all([
                    Promise.all(ttsPromises),
                    impliedOutcomesPromise
                ]);

                skit.outcomes = impliedOutcomes;
                console.log(`Implied outcomes for current end of skit:`, skit.outcomes);

                stage.pushMessage(text);

                return normalizedScriptEntries;
            }
        } catch (error) {
            console.error('Error generating skit script:', error);
        }
        retries--;
    }

    stage.saveGame();
    skit.outcomes = [];
    return [];
}

export function accumulateOutcomes(scriptEntries: ScriptEntry[]): Outcome[] {
    const statTotals = new Map<string, { outcome: Outcome; total: number; order: number }>();
    const factionReputationTotals = new Map<string, { outcome: Outcome; total: number; order: number }>();
    const roleHistories = new Map<string, { entries: { value: string; outcome: Outcome; order: number }[] }>();
    const factionHistories = new Map<string, { entries: { value: string; outcome: Outcome; order: number }[] }>();
    const movementOutcomesByActor = new Map<string, { outcome: Outcome; order: number }>();
    const acceptedModules: { outcome: Outcome; order: number }[] = [];
    const acceptedModuleNames: { name: string; index: number }[] = [];
    const acceptedOutfitsByActor = new Map<string, { outcome: Outcome; order: number }[]>();
    let orderCounter = 0;

    const nextOrder = (): number => orderCounter++;

    const appendNettingHistory = (
        history: { value: string; outcome: Outcome; order: number }[],
        value: string,
        outcome: Outcome
    ): { value: string; outcome: Outcome; order: number }[] => {
        const existingIndex = history.findIndex(entry => entry.value === value);

        if (existingIndex === history.length - 1) {
            return history;
        }

        if (existingIndex !== -1) {
            if (existingIndex === 0) {
                return [];
            }
            return history.slice(0, existingIndex + 1);
        }

        return [...history, { value, outcome, order: nextOrder() }];
    };

    for (const entry of scriptEntries) {
        for (const outcome of entry.outcomes || []) {
            switch (outcome.type) {
                case 'actorStat':
                case 'stationStat': {
                    const statKey = `${outcome.type}:${outcome.type === 'actorStat' ? outcome.actorId || '' : ''}:${String(outcome.stat || '')}`;
                    const current = statTotals.get(statKey) || { outcome: { ...outcome }, total: 0, order: nextOrder() };
                    current.total += outcome.amount || 0;
                    current.outcome = { ...current.outcome, amount: current.total };
                    statTotals.set(statKey, current);
                    break;
                }
                case 'factionReputation': {
                    const factionKey = outcome.factionId || '';
                    const current = factionReputationTotals.get(factionKey) || { outcome: { ...outcome }, total: 0, order: nextOrder() };
                    current.total += outcome.amount || 0;
                    current.outcome = { ...current.outcome, amount: current.total };
                    factionReputationTotals.set(factionKey, current);
                    break;
                }
                case 'roleChange': {
                    const actorKey = outcome.actorId || '';
                    const currentHistory = roleHistories.get(actorKey)?.entries || [];
                    const updatedHistory = appendNettingHistory(currentHistory, outcome.role || '', outcome);
                    if (updatedHistory.length === 0) {
                        roleHistories.delete(actorKey);
                    } else {
                        roleHistories.set(actorKey, { entries: updatedHistory });
                    }
                    break;
                }
                case 'factionChange': {
                    const actorKey = outcome.actorId || '';
                    const currentHistory = factionHistories.get(actorKey)?.entries || [];
                    const updatedHistory = appendNettingHistory(currentHistory, outcome.factionId || '', outcome);
                    if (updatedHistory.length === 0) {
                        factionHistories.delete(actorKey);
                    } else {
                        factionHistories.set(actorKey, { entries: updatedHistory });
                    }
                    break;
                }
                case 'movement': {
                    const actorKey = outcome.actorId || '';
                    if (!actorKey) {
                        break;
                    }

                    if (!outcome.factionId && !outcome.moduleId) {
                        break;
                    }

                    movementOutcomesByActor.set(actorKey, {
                        outcome: { ...outcome },
                        order: nextOrder()
                    });
                    break;
                }
                case 'newModule': {
                    const moduleName = outcome.module?.moduleName?.trim() || '';
                    if (!moduleName) {
                        break;
                    }

                    const similarExistingModule = findBestNameMatch(moduleName, acceptedModuleNames.map(existing => ({ name: existing.name })));
                    if (similarExistingModule) {
                        break;
                    }

                    acceptedModuleNames.push({ name: moduleName, index: acceptedModules.length });
                    acceptedModules.push({ outcome: { ...outcome, module: outcome.module ? { ...outcome.module } : outcome.module }, order: nextOrder() });
                    break;
                }
                case 'newOutfit': {
                    const actorId = outcome.outfit?.actorId || outcome.actorId || '';
                    const outfitName = outcome.outfit?.outfitName?.trim() || '';
                    if (!actorId || !outfitName) {
                        break;
                    }

                    const actorOutfits = acceptedOutfitsByActor.get(actorId) || [];
                    const similarExistingOutfit = findBestNameMatch(outfitName, actorOutfits.map(existing => ({ name: existing.outcome.outfit?.outfitName || '' })));
                    if (similarExistingOutfit) {
                        break;
                    }

                    actorOutfits.push({ outcome: { ...outcome, outfit: outcome.outfit ? { ...outcome.outfit } : outcome.outfit }, order: nextOrder() });
                    acceptedOutfitsByActor.set(actorId, actorOutfits);
                    break;
                }
            }
        }
    }

    const accumulated: { outcome: Outcome; order: number }[] = [];

    statTotals.forEach(({ outcome, total, order }) => {
        if (total !== 0) {
            accumulated.push({ outcome: { ...outcome, amount: total }, order });
        }
    });

    factionReputationTotals.forEach(({ outcome, total, order }) => {
        if (total !== 0) {
            accumulated.push({ outcome: { ...outcome, amount: total }, order });
        }
    });

    roleHistories.forEach(({ entries }) => {
        entries.forEach(entry => accumulated.push({ outcome: { ...entry.outcome, role: entry.value }, order: entry.order }));
    });

    factionHistories.forEach(({ entries }) => {
        entries.forEach(entry => accumulated.push({ outcome: { ...entry.outcome, factionId: entry.value }, order: entry.order }));
    });

    movementOutcomesByActor.forEach(({ outcome, order }) => {
        accumulated.push({ outcome: { ...outcome }, order });
    });

    acceptedModules.forEach(entry => accumulated.push({ outcome: entry.outcome, order: entry.order }));
    acceptedOutfitsByActor.forEach(entries => {
        entries.forEach(entry => accumulated.push({ outcome: entry.outcome, order: entry.order }));
    });

    return accumulated
        .sort((left, right) => left.order - right.order)
        .map(entry => entry.outcome);
}

export async function updateCharacterArc(stage: Stage, skit: SkitData, actor: Actor): Promise<void> {
    const analysisPrompt = buildSkitPrompt(skit, stage, 0,
        buildPromptSegment(`Scene Script for Analysis`, `${buildScriptLog(skit, [], stage)}`) +
        buildPromptSegment(`${actor.name}'s Current Character Arc`, `${actor.characterArc || 'No established character arc.'}`) +
        buildPromptSegment(`Instruction`, 
            `Analyze the preceding scene script and ${actor.name}'s character arc, then output a revised character arc paragraph that reflects any significant developments from the latest scene script. ` +
            `The character arc should be a concise summary of the character's growth, challenges, and changes experienced so far on the PARC. ` +
            `Focus on key emotional beats, relationships, and personal growth that have occurred up to this point. ` +
            `The output should be a single paragraph, maintaining the same tone and style as the existing character arc.` +
            `If there are no significant developments, simply repeat the existing character arc without changes. `) +
        buildPromptSegment(`Full Examples`, 
            `Revised Character Arc: John Smith has yet to find their footing in the PARC; they can't seem to make friends with the other patients—beyond the StationAide—, and the director hasn't proven trustworthy.\n[END]\n\n` +
            `Revised Character Arc: Jane Doe has started to open up to others, forming tentative friendships. She feels a bit out of her depth in her role as Custodian, but appreciates the trust the director has placed in her and hopes to prove that faith justified.\n[END]\n`)
        );
    
    const requestAnalysis = await stage.makeText({
        prompt: analysisPrompt,
        min_tokens: 50,
        max_tokens: 400,
        include_history: true,
        stop: ['[END]']
    });
    if (requestAnalysis) {
        let analysisText = requestAnalysis.trim();
        // Some prefix ending with "Arc:" may be present; remove it.
        const arcPrefixMatch = analysisText.match(/^(.*Arc:)/i);
        if (arcPrefixMatch) {
            analysisText = analysisText.substring(arcPrefixMatch[1].length).trim();
        }
        analysisText = analysisText.replace(/^"|"$/g, '').trim();
        // Update actor's character arc
        actor.characterArc = analysisText || actor.characterArc;
        console.log(`Updated character arc for ${actor.name}: ${actor.characterArc}`);
    }
}


export default {
    SkitType: SkitType
};

