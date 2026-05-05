import { AspectRatio } from '@chub-ai/stages-ts';
import { SkitType } from './Skit';
import { SaveType, Stage } from "./Stage";
import Actor from './actors/Actor';
import Faction from './factions/Faction';
import { ScreenType } from './screens/BaseScreen';
import { Build, Hotel, Restaurant, Security, AttachMoney, Favorite } from '@mui/icons-material';

export type ModuleType = 'echo chamber' | 'comms' | 'generator' | 'quarters' | 'commons' | 'infirmary' | 'gym' | 'lounge' | 'armory' 
    | 'cryo bank' | 'aperture' | 'director module'
    
    | string; // Allow string for modded modules

export enum StationStat {
    SYSTEMS = 'Systems',
    COMFORT = 'Comfort',
    PROVISION = 'Provision',
    SECURITY = 'Security',
    HARMONY = 'Harmony',
    WEALTH = 'Wealth'
}

// Icon mapping for station stats
export const STATION_STAT_ICONS: Record<StationStat, any> = {
    [StationStat.SYSTEMS]: Build,
    [StationStat.COMFORT]: Hotel,
    [StationStat.PROVISION]: Restaurant,
    [StationStat.SECURITY]: Security,
    [StationStat.HARMONY]: Favorite,
    [StationStat.WEALTH]: AttachMoney,
};

export const STATION_STAT_DESCRIPTIONS: Record<StationStat, string> = {
    'Systems': 'Mechanical and structural health of the station',
    'Comfort': 'Overall comfort and livability for inhabitants',
    'Provision': 'Availability of food, water, and essential supplies',
    'Security': 'Safety and defense against external and internal threats',
    'Harmony': 'Social cohesion and morale among inhabitants',
    'Wealth': 'Financial resources of the station and its Director'
};

export function getStatRating(score: number): StatRating {
    if (score <= 2) {
        return StatRating.POOR;
    } else if (score <= 4) {
        return StatRating.BELOW_AVERAGE;
    } else if (score <= 6) {
        return StatRating.AVERAGE;
    } else if (score <= 8) {
        return StatRating.GOOD;
    } else {
        return StatRating.EXCELLENT;
    }
}

// Mapping of StationStat to a set of prompt additions based on the 1-10 rating of the stat
// 5 ratings: 1-2 (poor), 3-4 (below average), 5-6 (average), 7-8 (good), 9-10 (excellent)
export enum StatRating {
    POOR = 'poor',
    BELOW_AVERAGE = 'below average',
    AVERAGE = 'average',
    GOOD = 'good',
    EXCELLENT = 'excellent'
}
export const STATION_STAT_PROMPTS: Record<StationStat, Record<StatRating, string>> = {
    'Systems': {
        [StatRating.POOR]: 'The station is plagued by frequent mechanical failures, computer glitches, and structural issues, making it barely operational.',
        [StatRating.BELOW_AVERAGE]: 'The station experiences occasional mechanical and electronic problems and minor structural concerns that need attention.',
        [StatRating.AVERAGE]: 'The station is generally functional with standard maintenance keeping systems operational, if finicky.',
        [StatRating.GOOD]: 'The station runs smoothly with well-maintained systems and minimal issues.',
        [StatRating.EXCELLENT]: 'The station boasts state-of-the-art systems and impeccable structural integrity, operating flawlessly.'
    },
    'Comfort': {
        [StatRating.POOR]: 'Living conditions are harsh, filthy, and downright unhealthy, leading to widespread dissatisfaction among inhabitants.',
        [StatRating.BELOW_AVERAGE]: 'Living conditions are subpar, messy, and unpleasant, with many inhabitants feeling uneasy in their environment.',
        [StatRating.AVERAGE]: 'Living conditions and cleanliness are acceptable, providing a basic level of comfort for inhabitants.',
        [StatRating.GOOD]: 'The station offers a comfortable, clean, and pleasant living environment for its inhabitants.',
        [StatRating.EXCELLENT]: 'Inhabitants enjoy luxurious, impeccable, and healthful living conditions, enhancing their overall well-being.'
    },
    'Provision': {
        [StatRating.POOR]: 'Essential supplies are scarce, leading to frequent shortages and hardships for inhabitants.',
        [StatRating.BELOW_AVERAGE]: 'Provision levels are inconsistent, with occasional shortages of food, water, and supplies.',
        [StatRating.AVERAGE]: 'The station maintains a steady supply of essentials, meeting the basic needs of inhabitants.',
        [StatRating.GOOD]: 'Provision levels are reliable, ensuring inhabitants have access to necessary supplies without issue.',
        [StatRating.EXCELLENT]: 'The station is abundantly stocked with essentials, providing more than enough for all inhabitants.'
    },
    'Security': {
        [StatRating.POOR]: 'The station is vulnerable to threats, with inadequate defenses and frequent security concerns.',
        [StatRating.BELOW_AVERAGE]: 'Security measures are weak, leading to occasional malfeasance and safety concerns among inhabitants.',
        [StatRating.AVERAGE]: 'The station has standard security protocols in place; inhabitants may occasionally act out but are generally kept in check.',
        [StatRating.GOOD]: 'Security is robust, effectively protecting the station and its inhabitants from threats.',
        [StatRating.EXCELLENT]: 'The station boasts top-tier security systems, ensuring unparalleled safety and protection for all.'
    },
    'Harmony': {
        [StatRating.POOR]: 'Social tensions run high and morale is non-existent, leading to frequent conflicts and a toxic atmosphere among inhabitants.',
        [StatRating.BELOW_AVERAGE]: 'Harmony is lacking and morale is low, with noticeable divisions and occasional disputes among inhabitants.',
        [StatRating.AVERAGE]: 'The social environment is stable, with decent morale and generally peaceful coexistence.',
        [StatRating.GOOD]: 'A strong sense of community and high morale prevails, fostering good vibes and positive relationships among inhabitants.',
        [StatRating.EXCELLENT]: 'Inhabitants enjoy a harmonious and supportive social environment, thriving together in unity.'
    },
    'Wealth': { // Wealther is financial resources of the station and its Director and does not necessarily reflect the personal wealth of inhabitants nor the station's overall provision levels
        [StatRating.POOR]: 'Financial resources are critically low, potentially leading to severe budget cuts and creditor threats.',
        [StatRating.BELOW_AVERAGE]: 'Wealth levels are low, leading to budget constraints and creditor complaints.',
        [StatRating.AVERAGE]: 'The Director maintains a stable financial footing, covering operational costs and bills.',
        [StatRating.GOOD]: 'The Director is financially healthy, with ample resources in reserve.',
        [StatRating.EXCELLENT]: 'The Director enjoys significant wealth, capable of lavish spending.'
    }
};

export interface ModuleIntrinsic {
    name: string;
    skitPrompt?: string; // Additional prompt text to influence the script in skit generation
    imagePrompt?: string; // Additional prompt text to describe the module in decor image generation
    role?: string;
    roleDescription?: string;
    baseImageUrl: string; // Base image that is used for theming through image2image calls
    defaultImageUrl: string; // Default themed version of the module
    cost: {[key in StationStat]?: number}; // Cost to build the module (StationStat name to amount)
    [key: string]: any; // Additional properties, if needed
    // Action method; each module has an action that will need to take the Module and Stage as contextual parameters:
    action?: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => void;
    available?: (stage: Stage) => boolean;
}

const randomAction = (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
    // Maybe move the module's owner (if any) here (make sure they aren't located at a faction):
    const owner = module.ownerId ? stage.getSave().actors[module.ownerId] : undefined;
    if (owner && !owner.isOffSite(stage.getSave()) && Math.random() < 0.5) {
        owner.locationId = module.id;
    }

    stage.setSkit({
        type: SkitType.RANDOM_ENCOUNTER,
        moduleId: module.id,
        script: [],
        generating: true,
        context: {},
    });
    setScreenType(ScreenType.SKIT);
};

export const MODULE_TEMPLATES: Record<ModuleType, ModuleIntrinsic> = {
    'echo chamber': {
        name: 'Echo Chamber',
        skitPrompt: 'The echo chamber is where the player fuses echoes from the nearby black hole. Scenes in this room typically involve newly echofused patients as they get their bearings.',
        imagePrompt: 'A futuristic lab with a bank of cryo pods along the left wall and some advanced computer systems against the right wall.',
        role: 'Assistant',
        roleDescription: `Manage station operations, monitoring the crew and supplementing their needs as the director's right hand.`,
        baseImageUrl: 'https://media.charhub.io/2f92a39f-02be-41fd-b61d-56de04a9ecc4/62d30715-01e1-4581-beb4-61cf31134955.png',
        defaultImageUrl: 'https://media.charhub.io/026ae01a-7dc8-472d-bfea-61548b87e6ef/84990780-8260-4833-ac0b-79c1a15ddb9e.png',
        cost: {}, // Free; starter module
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the station management screen
            console.log("Opening echo screen from command module.");
            // Use Stage API so any mounted UI can react to the change
            setScreenType(ScreenType.ECHO);
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'echo chamber').length === 0;
        }
    },
    comms: {
        name: 'Comms',
        skitPrompt: `The comms room is the hub for all external and internal station communications. ` +
            `This room is critical for communicating with external factions, with whom the PARC finds work for patients or conducts trade in exchange for desired resources. ` +
            `Scenes here often involve receiving important messages, coordinating among the crew, or managing station-wide announcements.`,
        imagePrompt: 'A sci-fi communications room dominated by a massive screen and associated computers and equipment, as well as some seating.',
        role: 'Liaison',
        roleDescription: `Handle all communications for the station, liaising with external entities and managing internal announcements.`,
        baseImageUrl: 'https://media.charhub.io/e13c7784-9f5f-4ec2-a179-5bab52973b3a/f5e69e63-88bf-4f7d-919b-41c8a2adcc6c.png',
        defaultImageUrl: 'https://media.charhub.io/9293912a-ebf4-4a0f-bac6-b9bfc82115f1/2ce9899c-a8cb-4186-9abb-fb8192ced8bd.png',
        cost: {}, // Free; starter module
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // If there is a rep from a faction here, open a faction interaction skit
            if (Object.values(stage.getSave().factions).some(a => a.representativeId && stage.getSave().actors[a.representativeId]?.locationId === module.id)) {
                const faction = Object.values(stage.getSave().factions).find(a => a.representativeId && stage.getSave().actors[a.representativeId]?.locationId === module.id);
                if (faction) {
                    // Move the module's owner (if any) here:
                    const owner = module.ownerId ? stage.getSave().actors[module.ownerId] : undefined;
                    if (owner && !owner.isOffSite(stage.getSave())) {
                        owner.locationId = module.id;
                    }
                    // Introduce a new faction:
                    if (!faction.active && faction?.reputation > 0) {
                        // Activate a new faction:
                        faction.active = true;
                        stage.setSkit({
                            type: SkitType.FACTION_INTRODUCTION,
                            moduleId: module.id,
                            script: [],
                            generating: true,
                            context: {factionId: faction.id,}
                        });
                    } else {
                        stage.setSkit({
                            type: SkitType.FACTION_INTERACTION,
                            moduleId: module.id,
                            script: [],
                            generating: true,
                            context: {factionId: faction.id}
                        });
                    }
                    setScreenType(ScreenType.SKIT);
                }
            } else if (Object.values(stage.getSave().actors).some(a => a.locationId === module.id)) {
                console.log("Opening skit.");
                stage.setSkit({
                    type: SkitType.RANDOM_ENCOUNTER,
                    moduleId: module.id,
                    script: [],
                    generating: true,
                    context: {}
                });
                setScreenType(ScreenType.SKIT);
            }
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'comms').length === 0;
        }
    },
    generator: {
        name: 'Generator',
        skitPrompt: 'The generator room serves as an engineering hub of sorts, where many of the station\'s mechanical systems can be managed. Scenes here often involve the station\'s overall systems health and stability.',
        imagePrompt: 'A sci-fi chamber dominated by a large, glowing generator, filled with humming machinery, control panels, and energy conduits.',
        role: 'Engineer',
        roleDescription: `Oversee the station's mechanical systems, ensuring all modules receive adequate energy and maintenance to function optimally.`,
        baseImageUrl: 'https://media.charhub.io/e53eeeb3-81a9-4020-a336-070c65edbb8a/4141ed00-9ab7-47f5-a4ce-21983b013e46.png',
        defaultImageUrl: 'https://media.charhub.io/36c3c8b5-1abd-4766-8042-fa7a2af0ce42/6106d6ec-7746-4130-8e13-860c89a325c7.png',
        cost: {}, // Free; starter module
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'generator').length === 0;
        }
    },
    quarters: {
        name: 'Quarters',
        skitPrompt: 'Crew quarters are personal living spaces for station inhabitants. Scenes here often involve personal interactions:  revelations, troubles, interests, or relaxation.',
        imagePrompt: 'A sci-fi living quarters with a bed, personal storage, and ambient lighting, reflecting the occupant\'s personality.',
        baseImageUrl: 'https://media.charhub.io/5e39db53-9d66-459d-8926-281b3b089b36/8ff20bdb-b719-4cf7-bf53-3326d6f9fcaa.png', 
        defaultImageUrl: 'https://media.charhub.io/99ffcdf5-a01b-43cf-81e5-e7098d8058f5/d1ec2e67-9124-4b8b-82d9-9685cfb973d2.png',
        cost: {Provision: 1},
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the skit screen to speak to occupants
            const owner = module.ownerId ? stage.getSave().actors[module.ownerId] : undefined;
            if (owner && !owner.isOffSite(stage.getSave())) {
                console.log("Opening skit.");
                owner.locationId = module.id; // Ensure actor is in the module
                stage.setSkit({
                    type: SkitType.VISIT_CHARACTER,
                    actorId: module.ownerId,
                    moduleId: module.id,
                    script: [],
                    generating: true,
                    context: {}
                });
                setScreenType(ScreenType.SKIT);
            }
        },
        available: (stage: Stage) => {
            // Can have multiple quarters; no restriction
            return true;
        }
    },
    commons: {
        name: 'Hub',
        skitPrompt: 'The hub is a place for patients and crew to gather, relax, eat, and interact. Scenes here often involve camaraderie, conflicts, and leisure activities among the crew.',
        imagePrompt: 'A sci-fi common area with a large table, seating, and storage and kitchen or vending facilities along the far wall.',
        role: 'Custodian',
        roleDescription: `Maintain the station's communal areas, ensuring they remain inviting and well-stocked for crew relaxation and socialization.`,
        baseImageUrl: 'https://media.charhub.io/0cee625e-73e7-43b3-86b3-a06c082e73a9/7f958523-48b9-40a4-ae67-59b0cea199d3.png', 
        defaultImageUrl: 'https://media.charhub.io/041617bd-1cb3-424d-8e66-788e60edc80d/3a21ddd2-bd66-40b0-84ca-68b11d8218b2.png',
        cost: {Provision: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'commons').length === 0;
        }
    },
    infirmary: {
        name: 'Infirmary',
        skitPrompt: 'The infirmary is the station\'s medical facility, where crew members receive treatment and care. Scenes here often involve medical incidents, health concerns, or ways to improve the crew\'s health and well-being.',
        imagePrompt: 'A futuristic medical bay with treatment beds and advanced diagnostic equipment.',
        role: 'Medic',
        roleDescription: `Provide medical care and emergency response for the crew, ensuring their health and well-being.`,
        baseImageUrl: 'https://media.charhub.io/b62f09a0-7a42-47e7-b0be-f54dfac00f33/fe73db8c-2cb6-4744-9464-6d26ecf776c0.png',
        defaultImageUrl: 'https://media.charhub.io/5e9c6119-51b4-4a2c-a06c-bb8f1c20aea1/c471f9ba-ea5f-495b-8e44-e02723a04938.png',
        cost: {Provision: 1, Comfort: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'infirmary').length === 0;
        }
    },
    gym: {
        name: 'Gym',
        skitPrompt: 'The gym is the station\'s fitness center, where crew members work out and maintain their physical health. Scenes here often involve training sessions, fitness challenges, or ways to boost crew morale through physical activity.',
        imagePrompt: 'A sci-fi gym with advanced exercise equipment and weightlifting stations.',
        role: 'Trainer',
        roleDescription: `Oversee the physical fitness and training of the crew, ensuring they remain in peak condition for their duties aboard the station.`,
        baseImageUrl: 'https://media.charhub.io/349ca504-7b7e-4afd-8a52-43dd7b166bc7/d91d37e1-eb9d-4211-a28f-16b8d4d341d1.png',
        defaultImageUrl: 'https://media.charhub.io/7f6bd636-804e-493c-8442-e691856a6703/589a3768-f0da-43c0-ab70-8b7d403f5a62.png',
        cost: {Comfort: 1, Wealth: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'gym').length === 0;
        }
    },
    lounge: {
        name: 'Lounge',
        skitPrompt: 'The lounge is a recreational area for the station crew, where they can unwind with a drink and socialize. Scenes here often involve leisure activities, social interactions, and ways to boost crew morale through relaxation and entertainment.',
        imagePrompt: 'A sci-fi lounge with comfortable seating, a wet bar, and entertainment systems.',
        role: 'Concierge',
        roleDescription: `Oversee the station's leisure facilities, ensuring crew members have a comfortable and enjoyable environment to relax and socialize.`,
        baseImageUrl: 'https://media.charhub.io/323b12cf-8687-4475-851b-7c1bdeff447a/0b71cb51-c160-47c9-848e-fab183eb9314.png',
        defaultImageUrl: 'https://media.charhub.io/2e8bf9fc-67a8-499d-85ec-8198efafeb14/1da73912-d19e-4f4e-aeda-19688e16e474.png',
        cost: {Comfort: 2, Wealth: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Require at least three patients on board to build a lounge:
            const patientCount = Object.values(stage.getSave().actors).filter(a => a.origin === 'patient').length;
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'lounge').length === 0 && patientCount >= 3;
        }
    },
    armory: {
        name: 'Armory',
        skitPrompt: 'The armory is the station\'s defense hub, where weapons and security systems are managed. Scenes here often involve security protocols, incident reports, or ways to enhance the station\'s safety and defense capabilities.',
        imagePrompt: 'A sci-fi armory with weapon lockers, equipment racks, and security equipment.',
        role: 'Officer',
        roleDescription: `Manage the station's defenses and ensure the safety of the crew against external and internal threats.`,
        baseImageUrl: 'https://media.charhub.io/7ccddb81-bed6-4395-80c6-912fe2932e53/c58a4f32-270d-4b62-b2b4-bcc1a3dedc94.png',
        defaultImageUrl: 'https://media.charhub.io/090e6a42-62f9-46da-9a29-09de8b469f05/eedf310f-af7a-40b4-ac56-686f4daa5c07.png',
        cost: {Systems: 1, Wealth: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Require to have met at least three factions:
            const metFactionsCount = Object.values(stage.getSave().factions).filter(f => f.active).length;
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'armory').length === 0 && metFactionsCount >= 3;
        }
    },
    'cryo bank': {
        name: 'Cryo Bank',
        skitPrompt: 'The cryo bank is where patients are placed in cryogenic stasis for long-term preservation. Scenes in this room often involve the ethical dilemmas of cryo-sleep, emergencies during stasis, or interactions with newly awakened patients.',
        imagePrompt: 'A futuristic lab with a bank of cryo pods along the left wall and some advanced computer systems against the right wall.',
        role: 'Keeper',
        roleDescription: `Oversee the cryogenic systems and ensure the safety and well-being of patients in stasis.`,
        baseImageUrl: 'https://media.charhub.io/439bcef8-3c12-4c07-b1fb-5659c0111edb/16e89185-6266-4ccf-a010-cf80090fcb08.png',
        defaultImageUrl: 'https://media.charhub.io/6dbe1503-e10a-48e4-875d-cc7a5038bc43/be0aa5dc-70b6-4573-ae48-c37d8e90022f.png',
        cost: {Harmony: 2, Systems: 2},
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the cryo management screen
            console.log("Opening cryo screen from cryo bank.");
            setScreenType(ScreenType.CRYO);
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout, and only once there are at least five patients:
            const patientCount = Object.values(stage.getSave().actors).filter(a => a.origin === 'patient').length;
            return stage.getLayout().getModulesWhere(m => m.type === 'cryo bank').length === 0 && patientCount >= 5;
        }
    },
    'aperture': {
        name: 'Aperture',
        skitPrompt: 'The aperture module is a specialized focusing mechanism for attenuating or shaping the echoes pulled from the black hole. Scenes here often involve scientific discussions about the ill-understood mechanics of echoefusion or unexpected phenomena.',
        imagePrompt: 'A sci-fi laboratory filled with advanced equipment. A large, circular machine frames a central window into space. There is a swirling black hole in the distance, with beams encircling it in a spiral pattern.',
        role: 'Attenuator',
        roleDescription: `Conduct research on spatial anomalies and manage the station's experimental echo projects.`,
        baseImageUrl: 'https://chub.ai/imagine/project/8ca887ea-ea20-4c53-9536-a4354e565246',
        defaultImageUrl: 'https://media.charhub.io/551ea94a-c64c-4328-a54a-08a8a356f261/ec7e47be-b157-4f71-a14d-4e45110e84f7.png',
        cost: {Systems: 2, Wealth: 2},
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the attenuation screen
            console.log("Opening aperture screen from aperture module.");
            setScreenType(ScreenType.APERTURE);
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout, and only once the station's Systems stat is at least 5:
            const systemsStat = stage.getSave().stationStats?.[StationStat.SYSTEMS] || 0;
            return stage.getLayout().getModulesWhere(m => m.type === 'aperture').length === 0 && systemsStat >= 5;
        }
    }
};

/**
 * Register a custom faction module template at runtime
 */
export function registerFactionModule(faction: Faction,
    type: string,
    intrinsic: ModuleIntrinsic
): void {
    registerModule(type, intrinsic, randomAction, (stage: Stage) => {
        // Custom modules can only be built once and require minimum reputation with the faction
        const factionRep = stage.getSave().factions[faction.id]?.reputation || 0;
        const existingCount = stage.getLayout().getModulesWhere(m => m.type === type).length;
        return existingCount === 0 && factionRep >= 6;
    });
}

export function registerModule(type: string, intrinsic: ModuleIntrinsic, action?: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => void, available?: (stage: Stage) => boolean): void {
    MODULE_TEMPLATES[type] = {...intrinsic,
        action: action || intrinsic.action || randomAction,
        available: available || ((stage: Stage) => {return stage.getLayout().getModulesWhere(m => m.type === type).length === 0})
    };
}

/**
 * Check if a module type is registered (either built-in or custom)
 */
export function isModuleTypeRegistered(type: string): boolean {
    return type in MODULE_TEMPLATES;
}

/**
 * Get the template for a module type
 */
export function getModuleTemplate(type: string): ModuleIntrinsic | undefined {
    return MODULE_TEMPLATES[type];
}

export class Module<T extends ModuleType = ModuleType> {
    public id: string;
    public type: T;
    public ownerId?: string; // For quarters, this is the occupant, for other modules, it is the character assigned to the associated role
    public attributes?: Partial<ModuleIntrinsic> & { [key: string]: any };

    /**
     * Rehydrate a Module from saved data
     */
    static fromSave(savedModule: any): Module {
        let type = savedModule.type === 'medbay' ? 'infirmary' : savedModule.type; // Backwards compatibility
        type = type === 'communications' ? 'comms' : type; // Backwards compatibility
        return createModule(type as ModuleType, {
            id: savedModule.id,
            attributes: savedModule.attributes,
            ownerId: savedModule.ownerId
        });
    }

    constructor(type: T, opts?: { id?: string; attributes?: Partial<ModuleIntrinsic> & { [key: string]: any }; ownerId?: string }) {
        this.id = opts?.id ?? `${type}-${Date.now()}`;
        this.type = type;
        this.ownerId = opts?.ownerId;
        this.attributes = opts?.attributes || {};
    }

    /**
     * Get all attributes with intrinsic defaults applied
     */
    getAttributes(): ModuleIntrinsic & { [key: string]: any } {
        const defaults = MODULE_TEMPLATES[this.type] || {};
        return { ...defaults, ...(this.attributes || {}) };
    }

    /**
     * Get a specific attribute with intrinsic default fallback
     */
    getAttribute<K extends keyof ModuleIntrinsic>(key: K): ModuleIntrinsic[K];
    getAttribute(key: string): any;
    getAttribute(key: string): any {
        const instanceValue = this.attributes?.[key];
        if (instanceValue !== undefined) {
            return instanceValue;
        }
        return MODULE_TEMPLATES[this.type]?.[key];
    }

    /**
     * Get the action method for this module type
     */
    getAction(): ((module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => void) {
        return MODULE_TEMPLATES[this.type]?.action || randomAction;
    }
}

export function createModule(type: ModuleType, opts?: { id?: string; attributes?: Partial<ModuleIntrinsic> & { [key: string]: any }; ownerId?: string }): Module {
    return new Module(type, opts);
}

export const DEFAULT_GRID_SIZE = 6; // Deprecated - use DEFAULT_GRID_WIDTH and DEFAULT_GRID_HEIGHT
export const DEFAULT_GRID_WIDTH = 8;
export const DEFAULT_GRID_HEIGHT = 5;

export type LayoutChangeHandler = (grid: Module[]) => void;

export class Layout {
    public grid: (Module | null)[][];
    public gridWidth: number;
    public gridHeight: number;
    // Deprecated: gridSize kept for backward compatibility
    public get gridSize(): number {
        return Math.max(this.gridWidth, this.gridHeight);
    }

    constructor(width: number = DEFAULT_GRID_WIDTH, height: number = DEFAULT_GRID_HEIGHT, initial?: (Module | null)[][]) {
        this.gridWidth = width;
        this.gridHeight = height;
        this.grid = initial || Array.from({ length: this.gridHeight }, () =>
            Array.from({ length: this.gridWidth }, () => null)
        );
    }

    /**
     * Rehydrate a Layout from saved data
     */
    static fromSave(savedLayout: any): Layout {
        const layout = Object.create(Layout.prototype);
        
        // Support both old square grids and new rectangular grids
        if (savedLayout.gridWidth !== undefined && savedLayout.gridHeight !== undefined) {
            layout.gridWidth = savedLayout.gridWidth;
            layout.gridHeight = savedLayout.gridHeight;
        } else {
            // Old save format - convert square grid to rectangular
            const oldSize = savedLayout.gridSize || DEFAULT_GRID_SIZE;
            layout.gridWidth = DEFAULT_GRID_WIDTH;
            layout.gridHeight = DEFAULT_GRID_HEIGHT;
        }
        
        // Rehydrate grid with proper Module instances
        const oldGrid = savedLayout.grid?.map((row: any[]) => 
            row?.map((savedModule: any) => 
                savedModule ? Module.fromSave(savedModule) : null
            )
        ) || [];
        
        // Create new grid with target dimensions
        layout.grid = Array.from({ length: layout.gridHeight }, () => 
            Array.from({ length: layout.gridWidth }, () => null)
        );
        
        // Copy modules from old grid, migrating out-of-bounds ones
        const modulesToRelocate: Module[] = [];
        
        for (let y = 0; y < oldGrid.length; y++) {
            for (let x = 0; x < (oldGrid[y]?.length || 0); x++) {
                const module = oldGrid[y][x];
                if (module) {
                    // Check if module fits in new grid
                    if (y < layout.gridHeight && x < layout.gridWidth) {
                        layout.grid[y][x] = module;
                    } else {
                        // Module is out of bounds, needs relocation
                        modulesToRelocate.push(module);
                    }
                }
            }
        }
        
        // Relocate out-of-bounds modules to first available empty spots
        for (const module of modulesToRelocate) {
            let relocated = false;
            for (let y = 0; y < layout.gridHeight && !relocated; y++) {
                for (let x = 0; x < layout.gridWidth && !relocated; x++) {
                    if (!layout.grid[y][x]) {
                        layout.grid[y][x] = module;
                        relocated = true;
                        console.log(`Migrated module ${module.type} from out-of-bounds to (${x}, ${y})`);
                    }
                }
            }
            if (!relocated) {
                console.warn(`Could not relocate module ${module.type} - grid is full`);
            }
        }
        
        return layout;
    }

    getLayout(): (Module | null)[][] {
        return this.grid;
    }

    setLayout(layout: (Module | null)[][]) {
        this.grid = layout;
    }

    getActorsAtModule(module: Module, save: SaveType): Actor[] {
        return Object.values(save.actors).filter(actor => actor.locationId === module.id);
    }

    getModulesWhere(predicate: (module: Module) => boolean): Module[] {
        const modules: Module[] = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const module = this.grid[y][x];
                if (module && predicate(module)) {
                    modules.push(module);
                }
            }
        }
        return modules;
    }

    getModuleById(id: string): Module | null {
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const module = this.grid[y][x];
                if (module && module.id === id) {
                    return module;
                }
            }
        }
        return null;
    }

    getModuleAt(x: number, y: number): Module | null {
        return this.grid[y]?.[x] ?? null;
    }

    getModuleCoordinates(module: Module | null): { x: number; y: number } {
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (module && this.grid[y][x]?.id === module?.id) {
                    return { x, y };
                }
            }
        }
        return {x: -1000, y: -1000};
    }

    setModuleAt(x: number, y: number, module: Module) {
        console.log(`Setting module at (${x}, ${y}):`, module);
        if (!this.grid[y]) return;
        this.grid[y][x] = module;
        console.log(`Module set. Current module at (${x}, ${y}):`, this.grid[y][x]);
    }

    removeModule(module: Module | null): boolean {
        if (!module) return false;
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x]?.id === module.id) {
                    this.grid[y][x] = null;
                    console.log(`Removed module ${module.id} at (${x}, ${y})`);
                    return true;
                }
            }
        }
        return false;
    }

    removeModuleAt(x: number, y: number): Module | null {
        const module = this.grid[y]?.[x] || null;
        if (module && this.grid[y]) {
            this.grid[y][x] = null;
            console.log(`Removed module ${module.id} at (${x}, ${y})`);
        }
        return module;
    }
}

export async function generateModule(name: string, stage: Stage, additionalInformation?: string, role?: string): Promise<ModuleIntrinsic|null> {
    // Generate a module from a module name, some arbitrary details, and a role title
    const generatedResponse = await stage.makeText({
        prompt: `{{messages}}This is preparatory request for structured and formatted game content. ` +
            `The goal is to define a module/room for a space station management game, based primarily upon the name, and potentially some other information, ` +
            `while generally avoiding duplicating existing content below. ` +
            `\n\nExisting Modules:\n${Object.entries(MODULE_TEMPLATES).map(([type, mod]) => `- ${type}: Role - ${mod.role || 'N/A'}`).join('\n')}` +
            `\n\nNew Module Name: ${name}\n` +
            (role ? `New Role Name: ${role}\n` : '') +
            (additionalInformation ? `Additional Information: ${additionalInformation || 'N/A'}\n` : '') +
            `\nBackground: This game is a futuristic multiverse setting that pulls characters from across eras and timelines and settings. ` +
            `The player of this game, ${stage.getSave().player.name}, manages a space station called the Post-Apocalypse Rehabilitation Center, or PARC, which resurrects victims of a multiversal calamity and helps them adapt to a new life, ` +
            `with the goal of placing these characters into a new role in this universe. ` +
            `Modules are rooms and facilities that make up the PARC station; each module has a function varying between utility and entertainment or anything inbetween, and serve as a backdrop for various interactions and events. ` +
            `Every module offers a crew-assignable role with an associated responsibility or purpose, which can again vary wildly between practical and whimsical.\n\n` +
            `Instructions: After carefully considering the provided details, generate a formatted definition for a distinct and inspired station module that suits the prompt, outputting it in the following strict format:\n` +
            `MODULE NAME: The module's simple name (1-2 words)\n` +
            `PURPOSE: A brief summary of the module's function and role on the station, as well as how that role might affect the station's patients or inform skits at this location.\n` +
            `DESCRIPTION: A vivid visual description of the module's appearance, to be fed into image generation.\n` +
            `ROLE NAME: The simple title of the role associated with this module (1-2 words).\n` +
            `ROLE DESCRIPTION: A brief summary of the responsibilities and duties associated with this role.\n` +
            `COST: The resource cost to build this module, specified as 1-3 points of one or two station stats. Available stats are: Systems, Comfort, Provision, Security, Harmony, Wealth. Format as "StatName X, StatName Y" (e.g., "Wealth 2, Systems 1" or "Provision 2").\n` +
            `#END#\n\n` +
            `Example Response:\n` +
            `MODULE NAME: Cryo Bank\n` +
            `PURPOSE: The cryo bank is where patients are placed in cryogenic stasis for long-term preservation. Scenes in this room often involve the ethical dilemmas of cryo-sleep, emergencies during stasis, or interactions with newly awakened patients.\n` +
            `DESCRIPTION: A futuristic lab with a bank of cryo pods along the left wall and some advanced computer systems against the right wall.\n` +
            `ROLE NAME: Keeper\n` +
            `ROLE DESCRIPTION: Responsible for managing the cryo bank, overseeing patient stasis, and ensuring the proper functioning of cryogenic equipment.\n` +
            `COST: Harmony 2, Systems 2\n` +
            `#END#\n\n` +
            `Example Response:\n` +
            `MODULE NAME: Gym\n` +
            `PURPOSE: The gym is the station's fitness center, where crew members work out and maintain their physical health. Scenes here often involve training sessions, fitness challenges, or ways to boost crew morale through physical activity.\n` +
            `DESCRIPTION: A sci-fi gym with advanced exercise equipment and weightlifting stations.\n` +
            `ROLE NAME: Trainer\n` +
            `ROLE DESCRIPTION: Oversees the physical fitness and training of the crew, ensuring they remain in peak condition for their duties aboard the station.\n` +
            `COST: Comfort 1, Wealth 1\n` +
            `#END#`,
        stop: ['#END'],
        include_history: true,
        max_tokens: 400,
    });

    console.log('Generated module distillation:');
    console.log(generatedResponse);

    if (!generatedResponse) {
        console.error('Failed to generate module');
        return null;
    }

    // Parse the generated response
    const lines = generatedResponse.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    
    let moduleName = '';
    let purpose = '';
    let description = '';
    let roleName = '';
    let roleDescription = '';
    let costString = '';

    for (const line of lines) {
        if (line.startsWith('MODULE NAME:')) {
            moduleName = line.substring('MODULE NAME:'.length).trim().toLowerCase();
        } else if (line.startsWith('PURPOSE:')) {
            purpose = line.substring('PURPOSE:'.length).trim();
        } else if (line.startsWith('DESCRIPTION:')) {
            description = line.substring('DESCRIPTION:'.length).trim();
        } else if (line.startsWith('ROLE NAME:')) {
            roleName = line.substring('ROLE NAME:'.length).trim();
        } else if (line.startsWith('ROLE DESCRIPTION:')) {
            roleDescription = line.substring('ROLE DESCRIPTION:'.length).trim();
        } else if (line.startsWith('COST:')) {
            costString = line.substring('COST:'.length).trim();
        }
    }

    // Validation
    if (!moduleName || !purpose || !description || !roleName || !roleDescription) {
        console.error('Failed to parse required fields from generated module', {
            moduleName, purpose, description, roleName, roleDescription
        });
        return null;
    }
    
    if (moduleName.length < 2 || moduleName.length > 30) {
        console.error('Module name has invalid length:', moduleName);
        return null;
    }

    // Parse cost with default fallback
    const parsedCost: {[key in StationStat]?: number} = {};
    
    if (costString) {
        // Parse cost string like "Wealth 2, Systems 1" or "Provision 2"
        const costParts = costString.split(',').map(s => s.trim());
        
        for (const part of costParts) {
            // Match pattern: "StatName Number"
            const match = part.match(/^([a-zA-Z]+)\s+(\d+)$/);
            if (match) {
                const statName = match[1];
                const amount = parseInt(match[2]);
                
                // Find matching StationStat (case-insensitive)
                for (const stat of Object.values(StationStat)) {
                    if (stat.toLowerCase() === statName.toLowerCase()) {
                        // Clamp to 1-3 as specified
                        parsedCost[stat] = Math.max(1, Math.min(3, amount));
                        break;
                    }
                }
            }
        }
    }
    
    // Apply default cost if parsing failed or resulted in no costs
    const finalCost = Object.keys(parsedCost).length > 0 
        ? parsedCost 
        : { [StationStat.WEALTH]: 2, [StationStat.SYSTEMS]: 1 }; // Default: 2 Wealth, 1 Systems

    const module: ModuleIntrinsic = {
        name: moduleName,
        skitPrompt: purpose,
        imagePrompt: description,
        role: roleName,
        roleDescription: roleDescription,
        baseImageUrl: '',
        defaultImageUrl: '',
        cost: finalCost,
    };

    await generateModuleImage(module, stage);

    if (!module.baseImageUrl || !module.defaultImageUrl) {
        console.error('Failed to generate images for module');
        return null;
    }

    return module;
}

export async function generateModuleImage(module: ModuleIntrinsic, stage: Stage): Promise<void> {
    // Start with a base image:
    const baseImageUrl = await stage.makeImage({
        prompt: `The detailed interior of an unoccupied futuristic space station module/room. The design should reflect the following description: ${module.imagePrompt}. ` +
            `Regardless of aesthetic, the image is rendered in a vibrant, painterly style with thick smudgy lines.`,
        aspect_ratio: AspectRatio.SQUARE
    }, '');
    if (!baseImageUrl) {
        return;
    }
    // Next, create a default variant with Qwen's image-to-image:
    const defaultImageUrl = await stage.makeImageFromImage({
        image: baseImageUrl,
        prompt: `Apply a visual novel art style to this sci-fi space station room (${module.imagePrompt}). Remove any characters from the scene.`,
        transfer_type: 'edit'
    }, '');
    if (baseImageUrl && defaultImageUrl) {
        module.baseImageUrl = baseImageUrl;
        module.defaultImageUrl = defaultImageUrl;
    }
}
