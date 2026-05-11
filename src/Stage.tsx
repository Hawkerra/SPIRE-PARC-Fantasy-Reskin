import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message, UpdateBuilder} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import Actor, { loadReserveActor, generateBaseActorImage, commitActorToEcho, Stat, generateAdditionalActorImages, loadReserveActorFromFullPath, ArtStyle, generateActorDecor, namesMatch } from "./actors/Actor";
import Faction, { generateFactionModule, generateFactionRepresentative, loadReserveFaction } from "./factions/Faction";
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, Layout, MODULE_TEMPLATES, StationStat, createModule, registerFactionModule, ModuleIntrinsic, generateModule, Module, registerModule } from './Module';
import { BaseScreen, ScreenType } from "./screens/BaseScreen";
import { generateSkitScript, generateSkitSummary, SkitData, SkitType, updateCharacterArc } from "./Skit";
import { smartRehydrate } from "./SaveRehydration";
import { Emotion, EmotionPromptMap, getDefaultEmotionPromptMap } from "./actors/Emotion";
import { assignActorToRole } from "./utils";
import { v4 as generateUuid } from 'uuid';

type MessageStateType = any;
type ConfigType = any;
type InitStateType = any;
type ChatStateType = {
    saves: (SaveType | undefined)[]
    lastSaveSlot: number;
}

type TimelineEvent = {
    day: number;
    turn: number;
    description: string;
    skit?: SkitData;
}

type Timeline = TimelineEvent[];

export type SaveType = {
    player: {name: string, description: string};
    aide: {name: string, description: string, actorId?: string};
    directorModule: {name: string, roleName: string, module?: ModuleIntrinsic};
    echoes: (Actor | null)[]; // actors currently in echo slots (can be null for empty slots)
    actors: {[key: string]: Actor};
    factions: {[key: string]: Faction};
    bannedTags?: string[];
    layout: Layout;
    customModules?: {[key: string]: ModuleIntrinsic};
    day: number;
    turn: number;
    timeline?: Timeline;
    currentSkit?: SkitData;
    stationStats?: {[key in StationStat]: number};
    timestamp?: number; // Time of last save
    disableTextToSpeech?: boolean;
    disableEmotionImages?: boolean;
    disableDecorImages?: boolean;
    characterArtStyle?: ArtStyle;
    characterArtist?: string;
    attenuation?: string;
    typeOutSpeed?: number;
    reserveActors?: Actor[];
    language?: string;
    tone?: string;
    disableImpersonation?: boolean;
    emotionPrompts?: EmotionPromptMap;
}

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    private currentSave: SaveType;
    private saves: (SaveType | undefined)[];
    private saveSlot: number = 0;
    public betaMode: boolean = false;
    // Flag/promise to avoid redundant concurrent requests for reserve actors
    public reserveActorsLoadPromise?: Promise<void>;
    private reserveFactionsLoadPromise?: Promise<void>;
    private generateAidePromise?: Promise<void>;
    public imageGenerationPromises: {[key: string]: Promise<string>} = {};
    private freshSave: SaveType;
    readonly SAVE_SLOTS = 10;
    readonly RESERVE_ACTORS = 5;
    readonly PREGEN_FACTION_COUNT = 3;
    readonly MAX_FACTIONS = 5;
    readonly FETCH_AT_TIME = 10;
    readonly MAX_PAGES = 200;
    readonly DEFAULT_TYPE_OUT_SPEED = 20;
    readonly bannedTagsDefault = [
        'FUZZ',
        'child',
        'teenager',
        'narrator',
        'underage',
        'multi-character',
        'multiple characters',
        'nonenglish',
        'non-english',
        'famous people',
        'celebrity',
        'real person',
        'feral'
    ];
    // At least one of these is required for a character search; some sort of gender helps indicate that the card represents a singular person.
    readonly actorTags = ['male', 'female', 'woman', 'man', 'masculine', 'feminine', 'non-binary', 'trans', 'genderqueer', 'genderfluid', 'agender', 'androgyne', 'intersex', 'futa', 'futanari', 'hermaphrodite'];
    // At least one of these is required for a faction search; helps indicate that the card has a focus on setting or tone.
    readonly factionTags = ['sci-fi', 'science fiction', 'cyberpunk', 'post-apocalyptic', 'dystopian', 'space', 'alien', 'robot', 'setting', 'world', 'narrator', 'scenario'];
    readonly characterSearchQuery = `https://inference.chub.ai/search?first=${this.FETCH_AT_TIME}&exclude_tags={{EXCLUSIONS}}&page={{PAGE_NUMBER}}&tags={{SEARCH_TAGS}}&sort=random&asc=false&include_forks=false&nsfw=true&nsfl=false` +
        `&nsfw_only=false&require_images=false&require_example_dialogues=false&require_alternate_greetings=false&require_custom_prompt=false&exclude_mine=false&min_tokens=200&max_tokens=5000` +
        `&require_expressions=false&require_lore=false&mine_first=false&require_lore_embedded=false&require_lore_linked=false&my_favorites=false&inclusive_or=true&recommended_verified=false&count=false&min_tags=3`;
    readonly characterDetailQuery = 'https://inference.chub.ai/api/characters/{fullPath}?full=true';

    readonly TONE_MAP: {[key: string]: string} = {
        'Original': 'The universe is a wild and evocative kaleidoscope, rich in diverse characters and organizations. ' +
            'Stories set in this universe can vary widely in tone—from lighthearted and humorous to dark and introspective—, but generally emphasize slice-of-life dramedy as patients navigate unlikely relationships and personal journeys.',
        'Gritty': 'The universe is a harsh and unforgiving landscape where survival is a constant struggle. ' +
            'Stories set in this universe tend to be dark and intense, with high stakes and morally complex characters. Themes of sacrifice, resilience, and the human spirit prevailing against all odds are common.',
        'Humorous': 'The universe is a whimsical and absurd place, where the bizarre and unexpected are commonplace. ' +
            'Stories set in this universe are lighthearted and comedic, often featuring eccentric characters and ridiculous situations. The tone is irreverent and playful, with a focus on humor and satire.',
        'Romantic': 'The universe is a lush and passionate realm, where love and desire are powerful forces that shape the lives of its inhabitants. ' +
            'Stories set in this universe are emotionally charged and erotic, often exploring complex relationships and intense emotions. The tone is sensual and evocative, with a focus on romance and interpersonal connections.',
    };

    private actorPageNumber = Math.floor(Math.random() * this.MAX_PAGES);
    private factionPageNumber = Math.floor(Math.random() * this.MAX_PAGES);

    private userId: string;
    private characterId: string;
    public isAuthenticated: boolean = false;
    


    // Expose a simple grid size (can be tuned)
    public gridWidth = DEFAULT_GRID_WIDTH;
    public gridHeight = DEFAULT_GRID_HEIGHT;
    // Deprecated: use gridWidth and gridHeight instead
    public get gridSize() {
        return Math.max(this.gridWidth, this.gridHeight);
    }

    screenProps: any = {};

    initialized: boolean = false;

    // Callback to show priority messages in the tooltip bar
    private priorityMessageCallback?: (message: string, icon?: any, durationMs?: number) => void;

    /**
     * Register a callback to show priority messages in the tooltip bar.
     * This is typically set by the App component that has access to the TooltipContext.
     */
    setPriorityMessageCallback(callback: (message: string, icon?: any, durationMs?: number) => void) {
        this.priorityMessageCallback = callback;
    }

    /**
     * Show a priority message in the tooltip bar that temporarily overrides normal tooltips.
     * @param message The message to display
     * @param icon Optional icon to show with the message
     * @param durationMs How long to show the message (default: 5000ms)
     */
    showPriorityMessage(message: string, icon?: any, durationMs: number = 5000) {
        if (this.priorityMessageCallback) {
            this.priorityMessageCallback(message, icon, durationMs);
        } else {
            console.warn('Priority message callback not set:', message);
        }
    }

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {

        super(data);
        const {
            characters,
            users,
            config,
            messageState,
            environment,
            initState,
            chatState
        } = data;

        console.log(characters);
        // voice_id is in the data but not on the Character type. However, it is the only field in the character data that is irreplicable by other means.
        // I believe it is the only way to verify that this chat involves the official PARC bot.
        this.isAuthenticated = Object.values(characters).some((c: any) => c['voice_id'] === '8d387ea3-6918-4628-927a-fe024745bea2');
        console.log('Authenticated:', this.isAuthenticated);

        console.log(chatState);
        this.saves = chatState?.saves || [];
        this.saveSlot = chatState?.lastSaveSlot || 0;

        this.betaMode = config?.beta_mode === "True";
        this.characterId = Object.keys(characters)[0];

        const layout = new Layout();
        // Center the starting modules in the 8x5 grid
        // For 8 wide: center is between columns 3 and 4, so use 3 and 4
        // For 5 tall: center is row 2, so use 1, 2, and 3
        const centerX = Math.floor(DEFAULT_GRID_WIDTH / 2);
        const centerY = Math.floor(DEFAULT_GRID_HEIGHT / 2);
        layout.setModuleAt(centerX, centerY + 1, createModule('director module', { id: `director-${centerX}-${centerY + 1}`, attributes: {} }));
        layout.setModuleAt(centerX - 1, centerY + 1, createModule('quarters', { id: `quarters-${centerX - 1}-${centerY + 1}`, attributes: {} }));
        layout.setModuleAt(centerX, centerY, createModule('echo chamber', { id: `echo-${centerX}-${centerY}`, attributes: {} }));
        layout.setModuleAt(centerX - 1, centerY, createModule('quarters', { id: `quarters-${centerX - 1}-${centerY}`, attributes: {} }));
        layout.setModuleAt(centerX, centerY - 1, createModule('generator', { id: `generator-${centerX}-${centerY - 1}`, attributes: {} }));
        layout.setModuleAt(centerX - 1, centerY - 1, createModule('comms', { id: `comms-${centerX - 1}-${centerY - 1}`, attributes: {} }));
        this.userId = Object.values(users)[0].anonymizedId;
        this.freshSave = { player: {name: Object.values(users)[0].name, description: Object.values(users)[0].chatProfile || ''}, 
            directorModule: {name: 'Director\'s Cabin', roleName: 'Maid'},
            aide: {
                name: 'Soji', 
                description: `Your holographic assistant is acutely familiar with the technical details of your Post-Apocalypse Rehabilitation Center, so you don't have to be! ` +
                `Your StationAide™ comes pre-programmed with a friendly and non-condescending demeanor that will leave you feeling empowered and never patronized; ` +
                `your bespoke projection comes with an industry-leading feminine form in a pleasing shade of default blue, but, as always, StationAide™ remains infinitely customizable to suit your tastes.`}, 
            echoes: [], actors: {}, factions: {}, layout: layout, day: 1, turn: 0, currentSkit: undefined, typeOutSpeed: this.DEFAULT_TYPE_OUT_SPEED, reserveActors: [], emotionPrompts: getDefaultEmotionPromptMap() };

        // ensure at least one save exists and has a layout
        if (!this.saves.length) {
            this.saves.push(this.getFreshSave());
        } else {
            // Rehydrate saves with proper class instances
            this.saves = this.saves.map(save => this.rehydrateSave(save));
        }
        if (this.saves.length < this.SAVE_SLOTS) {
            // Fill out to SAVE_SLOTS with fresh saves
            for (let i = this.saves.length; i < this.SAVE_SLOTS; i++) {
                this.saves.push(undefined);
            }
        }
        this.currentSave = this.saves[this.saveSlot] || this.getFreshSave();

        /*if (this.betaMode) {

            console.log('Registering tools.');
            this.mcp.registerTool('modify-station-stat',
                {
                    title: 'Modify Station Stat',
                    description: 'If events result in a change to a station stat, use this tool to register a station stat change.',
                    inputSchema: {
                        stat: z.enum(Object.values(StationStat) as [string, ...string[]]).describe('Station stat to modify'),
                        change: z.number().min(-10).max(10).describe('Amount to change the stat by'),
                    }
                },
                async ({ stat, change }): Promise<CallToolResult> => {
                    // Eventually, we will attach this to some sort of resolution content for the current skit, to be displayed in SkitScreen before the "Close" button becomes available, and executed when the skit ends.
                    // this.getSave().currentSkit ...
                    // For now, we're just testing that it works.
                    console.log(`Tool called: modifyStationStat(${stat}, ${change})`);
                    return { content: [{type: 'text', text: `Station stat ${stat} changed by ${change}.` }] };
                }
            );

            this.mcp.registerTool('modify-actor-stat', 
                {
                    title: 'Modify Actor Stat',
                    description: 'If events result in a change to an actor stat, use this tool to register an actor stat change.',
                    inputSchema: {
                        actor: z.string().min(1).describe('Name of the Actor whose stat is to be modified'),
                        stat: z.enum(Object.values(Stat) as [string, ...string[]]).describe('Actor stat to modify'),
                        change: z.number().min(-10).max(10).describe('Amount to change the stat by'),
                    }
                },
                async ({ actor, stat, change }): Promise<CallToolResult> => {
                    // Eventually, we will attach this to some sort of resolution content for the current skit, to be displayed in SkitScreen before the "Close" button becomes available, and executed when the skit ends.
                    // this.getSave().currentSkit ...
                    // For now, we're just testing that it works.
                    console.log(`Tool called: modifyActorStat(${actor}, ${stat}, ${change})`);
                    return { content: [{type: 'text', text: `Actor ${actor}'s stat ${stat} changed by ${change}.` }] };
                }
            );
        }*/
        
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {

        // Remove saves that have no actors or layout (they didn't even initialize an aide); set those indices to undefined
        this.saves = this.saves.map(save => (save && save.actors && Object.keys(save.actors).length > 0 && save.layout) ? save : undefined);

        this.currentSave = this.saves[this.saveSlot] || this.getFreshSave();

        return {
            success: true,
            error: null,
            initState: null,
            chatState: this.buildSaves(),
        };
    }

    pushMessage(message: string) {
        if (this.isAuthenticated) {
            this.messenger.impersonate({
                speaker_id: this.characterId,
                is_main: false,
                parent_id: null,
                message: message
            });
        }
    }

    incTurn(numberOfTurns: number = 1, setScreenType: (type: ScreenType) => void) {
        const save = this.getSave();
        save.turn += numberOfTurns;
        
        if (save.turn >= 4) {
            save.turn = 0;
            save.day += 1;
            // New day logic.
            // Increment actor role count
            for (let actor of Object.values(save.actors).filter(a => !a.factionId)) {
                // Find non-quarters module assigned to this actor and increment held role count
                const targetModule = save.layout.getModulesWhere(m => m.ownerId === actor.id && m.type !== 'quarters')[0];
                const roleName: string = targetModule?.getAttribute('role') || '';
                if (roleName && Object.keys(actor.heldRoles).indexOf(roleName) !== -1) {
                    actor.heldRoles[roleName] += 1;
                }
            }
        }

        // When incrementing turn, maybe move some actors around in the layout.
        for (const actorId in save.actors) {
            const actor = save.actors[actorId];
            try {
                if (['cryo', 'dead'].includes(actor.locationId)) {
                    // Cryo or dead patients don't move.
                    continue;
                }
                // Move faction actors to "in" their faction.
                if (actor.factionId) {
                    actor.locationId = actor.factionId;
                } else if (actor.id == save.aide.actorId) {
                    // Aide goes nowhere by default.
                    actor.locationId = '';
                } else if (!actor.locationId || save.layout.getModulesWhere(m => actor.locationId === m.id).length > 0) {
                    // If actor has no location or a location on the PARC (not away to a faction at the moment)
                    // Check if actor didn't move anywhere in the last skit, then put them in a random non-quarters module:
                    const previousSkit = (save.timeline && save.timeline.length > 0) ? save.timeline[save.timeline.length - 1].skit : undefined;
                    if ((!previousSkit || previousSkit.script.every(entry => !entry.movements || !Object.keys(entry.movements).some(moverId => moverId === actor.id)))) {
                        // Eligible modules are any non-quarters module with fewer than four people at that location, or their own quarters:
                        const eligibleModules = save.layout.getModulesWhere(m => (m.type !== 'quarters' && save.layout.getActorsAtModule(m, save).length < 4) || (m.type === 'quarters' && m.ownerId == actorId));
                        if (eligibleModules.length > 0) {
                            actor.locationId = eligibleModules.sort(() => Math.random() - 0.5)[0]?.id || '';
                        }
                    }
                }
                console.log(`Moved actor ${actor.name} to location ${actor.locationId}`);
                // If no patients exist, put the aide in the echo chamber:
                if (actor.id === save.aide.actorId && Object.values(save.actors).filter(a => !a.factionId && a.id !== save.aide.actorId).length === 0) {
                    const echoModule = save.layout.getModulesWhere(m => m.type === 'echo chamber')[0];
                    if (echoModule) {
                        actor.locationId = echoModule.id;
                    }
                }
            } catch (e) {
                console.error(`Error updating actor ${actor.name}:`, e);
            }
        }

        // Move a random faction rep to comms room, if any factions exist:
        const commsModule = save.layout.getModulesWhere(m => m.type === 'comms')[0];
        const eligibleFactions = Object.values(save.factions).filter(faction => faction.reputation > 0 && faction.representativeId && save.actors[faction.representativeId]);
        // If there are eligible factions and a comms module, and there is at least one non-remote actor other than the aide:
        if (eligibleFactions.length > 0 && commsModule && Object.values(save.actors).filter(a => !a.factionId && a.id !== save.aide.actorId).length > 0) {
            const randomFaction = eligibleFactions.sort(() => Math.random() - 0.5)[0];
            
            // Move the faction rep to the comms room, if available:
            const factionRep = save.actors[randomFaction.representativeId || ''];
            factionRep.locationId = commsModule.id;
        }

        this.currentSave = {...save}; // Update the current save slot with the modified save, ensuring a new object reference.
        this.saveGame();

        if (save.currentSkit) {
            console.log('In a skit');
            // If there's still a current skit, then it hasn't even started. Change screens back to SkitScreen:
            setScreenType(ScreenType.SKIT);
        } else {
            setScreenType(ScreenType.STATION);
        }
    }

    /**
     * Rehydrate a save object by restoring proper class instances
     */
    private rehydrateSave(save: any): SaveType {
        console.log('Rehydrating save:', save);
        
        // Restore turn from old phase variable.
        if (save && save['turn'] === undefined) {
            save['turn'] = save['phase'] || 0;
        }
        // Use smart rehydration to automatically detect and restore all nested objects
        const hydrated = smartRehydrate(save) as SaveType;
        if (hydrated) {
            hydrated.emotionPrompts = this.normalizeEmotionPromptMap(hydrated.emotionPrompts);
        }
        return hydrated;
    }

    private normalizeEmotionPromptMap(emotionPrompts?: Partial<EmotionPromptMap>): EmotionPromptMap {
        const defaultMap = getDefaultEmotionPromptMap();
        if (!emotionPrompts || typeof emotionPrompts !== 'object') {
            return defaultMap;
        }

        for (const emotion of Object.values(Emotion)) {
            const savedPrompt = emotionPrompts[emotion];
            if (typeof savedPrompt === 'string' && savedPrompt.trim()) {
                defaultMap[emotion] = savedPrompt;
            }
        }

        return defaultMap;
    }

    buildSaves(): ChatStateType {
        return {
            saves: this.saves,
            lastSaveSlot: this.saveSlot
        }
    }

    newGame() {
        // find first undefined save slot:
        this.saveSlot = this.saves.findIndex(save => !save);
        if (this.saveSlot === -1) {
            // Yikes, overwrite the last one. Should avoid this in the UI.
            this.saveSlot = Math.min(this.SAVE_SLOTS - 1, this.saves.length - 1);
        }
        this.currentSave = this.getFreshSave();
        this.saveGame();
    }

    saveGame() {
        if (this.currentSave.currentSkit && !this.betaMode) {
            return; // Don't save during an active skit (except in beta mode; just trying this out first).
        }
        // Update timestamp on current save
        this.currentSave.timestamp = Date.now();
        this.saves[this.saveSlot] = this.currentSave;
        const builtSaves = this.buildSaves();
        if (builtSaves.saves.some(save => save)) {
            void this.messenger.updateChatState(builtSaves);
        } else {
            console.warn('No saves to update in chat state; skipping messenger update.');
        }
    }

    saveAllGames() {
        void this.messenger.updateChatState(this.buildSaves());
    }

    deleteSave(slotIndex: number) {
        this.saves[slotIndex] = undefined;
        this.saveAllGames();
    }

    getSave(): SaveType {
        return this.currentSave;
    }

    getAllSaves(): (SaveType | undefined)[] {
        return this.saves;
    }

    getCurrentSlot(): number {
        return this.saveSlot;
    }

    getFreshSave(): SaveType {
        return this.rehydrateSave(JSON.parse(JSON.stringify(this.freshSave)));
    }

    loadSave(slotIndex: number) {
        this.saveSlot = slotIndex;
        this.currentSave = this.saves[this.saveSlot] || this.getFreshSave();
        this.initialized = false;
        this.startGame();
    }

    saveToSlot(slotIndex: number) {
        // Copy current save to target slot
        this.saves[slotIndex] = JSON.parse(JSON.stringify(this.currentSave));
        this.saveSlot = slotIndex;
        this.saveGame();
    }

    startGame() {
        if (this.initialized) return;
        this.initialized = true;
        // Called when a game is loaded or a new game is started
        console.log('Starting game...');

        if (!this.getSave().actors[this.getSave().aide.actorId || '']) {
            this.getSave().aide.actorId = undefined;
        } else {
            this.getSave().actors[this.getSave().aide.actorId || ''].origin = 'aide';
        }

        // Director module handling:
        // Create default director module if missing.
        if (!this.getSave().directorModule) {
            this.getSave().directorModule = { ...this.freshSave.directorModule };
        }

        this.generateUncreatedModules();
        
        const placeholderModule = {
            name: this.getSave().directorModule.name,
            skitPrompt: 'Crew quarters are personal living spaces for station inhabitants. Scenes here often involve personal interactions:  revelations, troubles, interests, or relaxation.',
            imagePrompt: 'A sci-fi living quarters with a bed, personal storage, and ambient lighting, reflecting the occupant\'s personality.',
            baseImageUrl: 'https://media.charhub.io/5e39db53-9d66-459d-8926-281b3b089b36/8ff20bdb-b719-4cf7-bf53-3326d6f9fcaa.png', 
            defaultImageUrl: 'https://media.charhub.io/99ffcdf5-a01b-43cf-81e5-e7098d8058f5/d1ec2e67-9124-4b8b-82d9-9685cfb973d2.png',
            role: this.getSave().directorModule.roleName,
            roleDescription: '',
            cost: {
                Wealth: 3,
            },
            action: 
                (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
                    stage.setSkit({
                        type: SkitType.DIRECTOR_MODULE,
                        moduleId: module.id,
                        script: [],
                        generating: true,
                        context: {},
                    });
                    setScreenType(ScreenType.SKIT);
                }
        };

        // No generated module; generate it now.
        if (!this.getSave().directorModule.module) {
            // Register placeholder:
            registerModule('director module',
                placeholderModule
            );

            // Kick off director module generation
            generateModule(this.getSave().directorModule.name, this, 
                `This is a module designed specifically around the Director, ${this.getSave().player.name}, and their needs or tastes.\n` +
                `About the Director, ${this.getSave().player.name}:\n${this.getSave().player.description}`,
                this.getSave().directorModule.roleName).then(module => {
                    if (module) {
                        this.getSave().directorModule.module = module;
                        registerModule('director module', module, placeholderModule.action);
                        this.saveGame();
                    }
            });
        } else {
            // Register existing director module
            registerModule('director module', this.getSave().directorModule.module || placeholderModule, placeholderModule.action);
        }

        if (!this.getSave().characterArtStyle) {
            this.getSave().characterArtStyle = 'original';
        }

        if (this.getSave().typeOutSpeed === undefined) {
            this.getSave().typeOutSpeed = this.DEFAULT_TYPE_OUT_SPEED;
        }

        // Initialize reserveActors if missing
        if (!this.getSave().reserveActors) {
            this.getSave().reserveActors = [];
        }

        this.generateAide();
        if (!this.generateAidePromise) {
            // Load these if only a fresh aide is not being generated (trying to reduce concurrent generation requests)
            this.loadReserveActors();
            this.loadReserveFactions();
        }

        const save = this.getSave();
        // Initialize stationStats if missing
        if (!save.stationStats || Object.keys(save.stationStats).length < 6) {
            save.stationStats = {
                'Systems': 3,
                'Comfort': 3,
                'Provision': 3,
                'Security': 3,
                'Harmony': 3,
                'Wealth': 3
            };
        }
        if (!save.factions) {
            save.factions = {};
        }

        // Clean out remote actors that aren't supported by current factions
        const idsToRemove: string[] = [];
        Object.values(save.actors).filter(actor => actor.factionId && (!save.factions || !Object.values(save.factions).some(faction => faction.id === actor.factionId))).forEach(actor => {
            idsToRemove.push(actor.id);
        });
        idsToRemove.forEach(id => {
            delete save.actors[id];
        });

        // Register custom modules:
        if (save.customModules) {
            Object.entries(save.customModules).forEach(([key, moduleIntrinsic]) => {
                registerModule(key, moduleIntrinsic);
            });
        }

        // Register faction modules and repair faction reps that don't have a factionId set:
        Object.values(save.factions).forEach(faction => {
            if (faction.module) {
                console.log(`Registering module ${faction.module.name} for faction ${faction.name}`);
                registerFactionModule(faction, faction.id, faction.module);
            } else if (faction.reputation >= 5) {
                // Kick off module generation for this faction:
                console.log('Generating module for faction:', faction.name);
                generateFactionModule(faction, this).then(moduleName => {
                    if (moduleName) {
                        this.showPriorityMessage(`New module "${moduleName}" now available!`);
                    }
                });
            }
            if (faction.representativeId && save.actors[faction.representativeId]) {
                const repActor = save.actors[faction.representativeId];
                repActor.origin = 'faction';
                if (repActor.factionId !== faction.id) {
                    console.log(`Repairing factionId for representative ${repActor.name} of faction ${faction.name}`);
                    repActor.factionId = faction.id;
                }
            }
        });

        save.layout.getModulesWhere(m => true).forEach(module => {
            if (!Object.keys(MODULE_TEMPLATES).includes(module.type)) {
                console.log(`Removing unknown module type ${module.getAttribute('name')} from layout.`);
                save.layout.removeModule(module);
            }
        });

        // If any echo actors are missing primary images, kick those off now.
        for (const echoActor of save.echoes) {
            if (echoActor && (!echoActor.getEmotionImageUrl(Emotion.neutral) || echoActor.getEmotionImageUrl(Emotion.neutral) == echoActor.avatarImageUrl)) {
                generateBaseActorImage(echoActor, this).then(() => {
                    this.saveGame();
                });
            }
        }

        // If there are any actors in the save with missing emotion images, kick one of them off now.
        for (const actorId in save.actors) {
            const actor = save.actors[actorId];
            if (!actor.getEmotionImageUrl(Emotion.neutral) || actor.getEmotionImageUrl(Emotion.neutral) == actor.avatarImageUrl) {
                generateBaseActorImage(actor, this).then(() => {
                    this.saveGame();
                });
                break; // only do one at a time
            } else if (!actor.factionId && Object.values(Emotion).some(emotion => emotion !== Emotion.neutral && (
                    !actor.getEmotionImageUrl(emotion) || 
                    actor.getEmotionImageUrl(emotion) == actor.avatarImageUrl || 
                    actor.getEmotionImageUrl(emotion) == actor.getEmotionImageUrl(Emotion.neutral)))) {
                generateAdditionalActorImages(actor, this).then(() => {
                    this.saveGame();
                });
                break; // only do one at a time
            }
        }
    }

    getGenerateAidePromise(): Promise<void> | undefined {
        return this.generateAidePromise;
    }

    async generateAide() {
        if (this.generateAidePromise) return this.generateAidePromise;

        let save = this.getSave();
        if (!save.aide || !save.aide.actorId) {
            // If aide already exists, do nothing

            this.generateAidePromise = (async () => {
                // Generate a new aide
                const actorData = {
                    name: save.aide.name,
                    fullPath: '',
                    personality: `The PARC's StationAide™ holographic assistant: ${save.aide.description}`
                }
                // Retry a few times if it fails (or returns null):
                for (let attempt = 0; attempt < 3; attempt++) {
                    const aideActor = await loadReserveActor(actorData, this);
                    if (aideActor) {
                        save = this.getSave();
                        save.actors[aideActor.id] = aideActor;
                        aideActor.name = save.aide.name;
                        aideActor.origin = 'aide';
                        aideActor.profile = save.aide.description;
                        save.aide.actorId = aideActor.id;
                        save.actors[aideActor.id] = aideActor;
                        await generateBaseActorImage(aideActor, this);
                        break;
                    }
                }
                this.generateAidePromise = undefined;
                this.loadReserveActors();
                this.loadReserveFactions();
            })();
        }
        return this.generateAidePromise;
    }

    async loadReserveActorFromFullPath(fullPath: string) {
        console.log('Loading reserve actor from fullPath:', fullPath);
        if (this.reserveActorsLoadPromise) return this.reserveActorsLoadPromise;

        this.reserveActorsLoadPromise = (async () => {
            try {
                console.log('Loading targeted reserve actor...');
                const newActor = await loadReserveActorFromFullPath(fullPath, this);
                if (newActor !== null) {
                    this.getSave().reserveActors = [...(this.getSave().reserveActors || []), newActor];
                    this.saveGame();
                } else {
                    this.showPriorityMessage(`Failed to load character ${fullPath}.`);
                }
            } catch (err) {
                console.error('Error loading reserve actors', err);
            }
        })();

        this.reserveActorsLoadPromise?.then(() => {
            this.reserveActorsLoadPromise = undefined;
        });

        return this.reserveActorsLoadPromise;
    }

    async loadReserveActors() {
        // If a load is already in-flight, return the existing promise to dedupe concurrent calls
        if (this.reserveActorsLoadPromise) return this.reserveActorsLoadPromise;

        this.reserveActorsLoadPromise = (async () => {
            try {
                console.log('Loading reserve actors...');
                let reserveActors = this.getSave().reserveActors || [];
                while (reserveActors.length < this.RESERVE_ACTORS) {
                    // Populate reserveActors; this is loaded with data from a service, calling the characterServiceQuery URL:
                    const exclusions = (this.getSave().bannedTags || []).concat(this.bannedTagsDefault).map(tag => encodeURIComponent(tag)).join('%2C');
                    const response = await fetch(this.characterSearchQuery
                        .replace('{{PAGE_NUMBER}}', this.actorPageNumber.toString())
                        .replace('{{EXCLUSIONS}}', exclusions ? exclusions + '%2C' : '')
                        .replace('{{SEARCH_TAGS}}', this.actorTags.concat(this.actorTags).join('%2C')));
                    const searchResults = await response.json();
                    console.log(searchResults);
                    // Need to do a secondary lookup for each character in searchResults, to get the details we actually care about:
                    const basicCharacterData = searchResults.data?.nodes.filter((item: string, index: number) => index < this.RESERVE_ACTORS - reserveActors.length).map((item: any) => item.fullPath) || [];
                    if (searchResults.data?.nodes.length === 0) {
                        console.warn('No more characters found from search results; resetting page number to 1 to retry with the same parameters.');
                        this.actorPageNumber = 1;
                    } else {
                        this.actorPageNumber = (this.actorPageNumber % this.MAX_PAGES) + 1;
                    }
                    console.log(basicCharacterData);

                    const newActors: Actor[] = await Promise.all(basicCharacterData.map(async (fullPath: string) => {
                        return loadReserveActorFromFullPath(fullPath, this);
                    }));

                    this.getSave().reserveActors = [...this.getSave().reserveActors || [], ...newActors.filter(a => a !== null)];
                    reserveActors = this.getSave().reserveActors || [];
                }
                this.saveGame();
            } catch (err) {
                console.error('Error loading reserve actors', err);
            }
        })();

        this.reserveActorsLoadPromise?.then(() => {
            this.reserveActorsLoadPromise = undefined;
        });

        return this.reserveActorsLoadPromise;
    }

    async loadReserveFactions() {
        // If a load is already in-flight, return the existing promise to dedupe concurrent calls
        if (this.reserveFactionsLoadPromise) return this.reserveFactionsLoadPromise;

        this.reserveFactionsLoadPromise = (async () => {
            try {
                console.log('Loading additional factions...');
                const eligibleFactions = Object.values(this.getSave().factions).filter(faction => faction.reputation > 0);
                while (eligibleFactions.length < this.MAX_FACTIONS) {
                    const needed = this.MAX_FACTIONS - eligibleFactions.length;
                    // Populate reserveFactions; this is loaded with data from a service, calling the characterSearchQuery URL:
                    const exclusions = (this.getSave().bannedTags || []).concat(this.bannedTagsDefault).map(tag => encodeURIComponent(tag)).join('%2C');
                    const response = await fetch(this.characterSearchQuery
                        .replace('{{PAGE_NUMBER}}', this.factionPageNumber.toString())
                        .replace('{{EXCLUSIONS}}', exclusions ? exclusions + '%2C' : '')
                        .replace('{{SEARCH_TAGS}}', this.factionTags.concat(this.factionTags).join('%2C')));
                    const searchResults = await response.json();
                    console.log(searchResults);
                    // Need to do a secondary lookup for each faction in searchResults, to get the details we actually care about:
                    const basicFactionData = searchResults.data?.nodes.filter((item: string, index: number) => index < needed).map((item: any) => item.fullPath) || [];
                    this.factionPageNumber = (this.factionPageNumber % this.MAX_PAGES) + 1;
                    console.log(basicFactionData);
                    // Do these in series instead of parallel to reduce load on the service:
                    const newFactions: Faction[] = [];
                    for (const fullPath of basicFactionData) {
                        const faction = await loadReserveFaction(fullPath, this);
                        if (faction !== null) {
                            newFactions.push(faction);
                        }
                    }
                    newFactions.forEach(faction => {if (faction != null) {eligibleFactions.push(faction); this.getSave().factions[faction.id] = faction;}});
                }
            } catch (err) {
                console.error('Error loading reserve factions', err);
            }
        })();

        this.reserveFactionsLoadPromise?.then(() => {
            this.reserveFactionsLoadPromise = undefined;
        });

        return this.reserveFactionsLoadPromise;
    }

    getLayout(): Layout {
        return this.getSave().layout;
    }

    async setState(state: MessageStateType): Promise<void> {
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {

        return {
            stageDirections: null,
            messageState: {},
            modifiedMessage: null,
            systemMessage: null,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {

        return {
            stageDirections: null,
            messageState: {},
            modifiedMessage: null,
            error: null,
            systemMessage: null,
            chatState: null
        };
    }

    async makeText(textRequest: Object): Promise<string> {
        const response = await this.generator.textGen(textRequest);
        if (response?.result) {
        // The response may begin with thinking text in <thinking> tags; remove that.
            let resultText = response.result;
            // Strip double-asterisks. TODO: Remove this once other model issue is resolved.
            resultText = resultText.replace(/\*\*/g, '');
            const thinkingTagPattern = /<thinking>(.*?)<\/thinking>/gs;
            resultText = resultText.replace(thinkingTagPattern, '').trim();
            // The response may have "System:" in it, which indicates the location of the text we actually want to return; anything before and including "System:" should be removed.
            const systemTagIndex = resultText.indexOf('System:');
            if (systemTagIndex !== -1) {
                resultText = resultText.substring(systemTagIndex + 'System:'.length).trim();
            }

            return resultText;
        }
        return '';
    }

    async makeImage(imageRequest: Object, defaultUrl: string): Promise<string> {
        return (await this.generator.makeImage(imageRequest))?.url ?? defaultUrl;
    }

    async makeImageFromImage(imageToImageRequest: any, defaultUrl: string): Promise<string> {

        const imageUrl = (await this.generator.imageToImage(imageToImageRequest))?.url ?? defaultUrl;
        if (imageToImageRequest.remove_background && imageUrl != defaultUrl) {
            try {
                return this.removeBackground(imageUrl);
            } catch (exception: any) {
                console.error(`Error removing background from image, error`, exception);
                return imageUrl;
            }
        }
        return imageUrl;
    }

    async removeBackground(imageUrl: string) {
        if (!imageUrl) return imageUrl;
        try {
            const response = await this.generator.removeBackground({image: imageUrl});
            return response?.url ?? imageUrl;
        } catch (error) {
            console.error(`Error removing background`, error);
            return imageUrl;
        }
    }

    async commitActorToEcho(actorId: string, slotIndex: number): Promise<void> {
        const actor = (this.getSave().reserveActors || []).find(a => a.id === actorId) || this.getSave().echoes.find(a => a?.id === actorId);
        if (actor) {
            const save = this.getSave();
            // Ensure echoes array has 3 slots
            if (save.echoes.length < 3) {
                save.echoes = [...save.echoes, ...Array(3 - save.echoes.length).fill(null)];
            }
            // Remove from any existing slot
            save.echoes = save.echoes.map(slot => slot?.id === actorId ? null : slot);
            // Place in new slot
            save.echoes[slotIndex] = actor;
            console.log('Committing actor to echo slot:', actor, slotIndex);
            commitActorToEcho(actor, this);
            
            this.saveGame();
        }
    }

    removeActorFromEcho(actorId: string, thenSave: boolean): void {
        const save = this.getSave();
        save.echoes = save.echoes.map(slot => slot?.id === actorId ? null : slot);
        if (thenSave) {
            this.saveGame();
        }
    }

    getEchoSlots(): (Actor | null)[] {
        const save = this.getSave();
        // Ensure we always return an array of 3 slots
        const echoes = save.echoes || [];
        return [...echoes, ...Array(Math.max(0, 3 - echoes.length)).fill(null)].slice(0, 3);
    }

    setSkit(skit: SkitData) {
        const module = this.getSave().layout.getModuleById(skit.moduleId);
        if (module && module.ownerId) {
            generateActorDecor(this.getSave().actors[module.ownerId], module, this);
        }
        const save = this.getSave() as any;
        save.currentSkit = skit;
    }

    generateUncreatedModules() {
        // Go through past skits in the timeline and find any with endNewModule data, and generate those modules if they don't already exist.
        const save = this.getSave();
        const skitsToProcess: SkitData[] = [];
        if (save.timeline) {
            save.timeline.forEach(entry => {
                if (entry.skit && entry.skit.endNewModule && this.getSave()?.customModules?.[entry.skit.endNewModule.id] === undefined) {
                    skitsToProcess.push(entry.skit);
                }
            });
        }

        skitsToProcess.forEach(skit => {
            if (skit.endNewModule) {
                const moduleData = skit.endNewModule;
                // Kick off module generation
                generateModule(moduleData.moduleName, this, 
                    moduleData.description,
                    moduleData.roleName).then(module => {
                        if (module) {
                            this.getSave().customModules = { ...this.getSave().customModules, [moduleData.id]: module };
                            registerModule(moduleData.id, module);
                            this.saveGame();
                            // Show priority message in tooltip
                            this.showPriorityMessage(`New module "${moduleData.moduleName}" now available!`);
                        }
                });
            }
        });
    }

    endSkit(setScreenType: (type: ScreenType) => void) {
        const save = this.getSave();
        if (save.currentSkit) {
            if (save.currentSkit.type === SkitType.EXIT_CRYO) {
                this.pushToTimeline(save, `${save.actors[save.currentSkit.actorId ?? '']?.name || 'An unknown individual'} thawed from cryostasis.`);
            } else if (save.currentSkit.type === SkitType.INTRO_CHARACTER) {
                this.pushToTimeline(save, `New patient, ${save.actors[save.currentSkit.actorId ?? '']?.name || 'An unknown individual'}, fused from echo.`);
            }
            // Save skit to timeline first, so (most) outcomes save afterward.
            this.pushToTimeline(save, `${save.currentSkit.type} skit.`, save.currentSkit);

            this.generateUncreatedModules();

            // Apply generated appearance outcomes.
            if (save.currentSkit.endNewAppearances) {
                save.currentSkit.endNewAppearances.forEach(appearanceData => {
                    const actor = save.actors[appearanceData.actorId];
                    if (actor) {
                        const alreadyExists = actor.outfits.some(outfit => namesMatch(outfit.name, appearanceData.appearanceName));
                        if (!alreadyExists) {
                            const newOutfitId = appearanceData.id || generateUuid();
                            actor.outfits.push({
                                id: newOutfitId,
                                name: appearanceData.appearanceName,
                                description: appearanceData.description,
                                emotionPack: {},
                            });

                            // Kick off outfit portrait generation in the background.
                            generateBaseActorImage(actor, this, false, true, newOutfitId).then(() => {
                                this.showPriorityMessage(`New appearance for ${actor.name}: "${appearanceData.appearanceName}"`);
                                this.saveGame();
                                return generateAdditionalActorImages(actor, this, newOutfitId);
                            }).catch((err) => {
                                console.error('Error generating images for new appearance outcome:', err);
                            });
                        }
                    }
                });
            }

            // Apply endProperties to actors - find from the final entry with endScene=true
            let endProps: { [actorId: string]: { [stat: string]: number } } = save.currentSkit.endProperties || {};
            let endFactionChanges: { [actorId: string]: string } = save.currentSkit.endFactionChanges || {};
            let endRoleChanges: { [actorId: string]: string } = save.currentSkit.endRoleChanges || {};

            // Apply role changes to actors
            for (const actorId in endRoleChanges) {
                const actor = save.actors[actorId];
                if (!actor) continue;

                const newRole = endRoleChanges[actorId];
                console.log(`Changing ${actor.name}'s role to ${newRole || 'None'}`);

                // If newRole is not empty, find the module with that role and assign the actor
                if (newRole) {
                    // Find module with matching role
                    const roleModules = save.layout.getModulesWhere(m => {
                        const moduleRole = m.getAttribute('role');
                        return !!(moduleRole && moduleRole.toLowerCase() === newRole.toLowerCase());
                    });

                    if (roleModules.length > 0) {
                        const targetModule = roleModules[0];
                        // Clear any existing owner
                        if (targetModule.ownerId) {
                            console.log(`Removing previous owner from ${targetModule.getAttribute('name')} role`);
                        }
                        
                        // Use centralized role assignment logic
                        assignActorToRole(this, actor, targetModule, save.layout);
                        console.log(`Assigned ${actor.name} to ${newRole} role in ${targetModule.getAttribute('name')} module`);
                    } else {
                        console.warn(`No module found with role: ${newRole}`);
                    }
                } else {
                    // If newRole is empty, just clear any current role assignments
                    const currentRoleModules = save.layout.getModulesWhere(m => m.type !== 'quarters' && m.ownerId === actor.id);
                    currentRoleModules.forEach(module => {
                        console.log(`Removing ${actor.name} from ${module.getAttribute('name')} role`);
                        module.ownerId = '';
                    });
                }
            }

            // Apply faction changes to actors
            for (const actorId in endFactionChanges) {
                const actor = save.actors[actorId];
                const newFactionId = endFactionChanges[actorId];
                if (actor && actor.factionId != newFactionId) {
                    console.log(`Changing ${actor.name}'s faction from ${actor.factionId || 'PARC'} to ${newFactionId || 'PARC'}`);
                    
                    // If currently a faction rep and joining PARC (factionId = ''), need to generate a new faction rep:
                    if (newFactionId === '') {
                        const currentFaction = Object.values(save.factions).find(faction => faction.representativeId === actor.id);
                        this.pushToTimeline(save, `${actor.name}, formerly of the ${currentFaction?.name || 'unknown faction'} joined the ${newFactionId ? save.factions[newFactionId]?.name || 'unknown faction' : 'PARC'}.`);
                        if (currentFaction) {
                            console.log(`Generating new representative for faction ${currentFaction.name} as ${actor.name} is leaving.`);
                            generateFactionRepresentative(currentFaction, this).then(() => {
                                console.log(`Generated new faction representative for ${currentFaction.name}`);
                            })
                        }
                        // Clear locationId if it was set to a faction
                        if (actor.locationId && !save.layout.getModuleById(actor.locationId)) {
                            actor.locationId = '';
                        }
                    } else {
                        // If joining a faction, set locationId to the factionId
                        this.pushToTimeline(save, `${actor.name} left the ${actor.factionId ? save.factions[actor.factionId]?.name || 'unknown faction' : 'PARC'} to join the ${newFactionId ? save.factions[newFactionId]?.name || 'unknown faction' : 'PARC'}.`);
                        actor.locationId = newFactionId;
                        // Free up rooms owned by this actor
                        save.layout.getModulesWhere(m => m.ownerId === actor.id).forEach(module => {
                            module.ownerId = '';
                        });
                    }
                    actor.factionId = newFactionId;
                }
            }

            for (const actorId in endProps) {
                const actorChanges = endProps[actorId];
                
                // Handle Faction reputation changes
                if (actorId === 'FACTION') {
                    Object.entries(endProps[actorId]).forEach(([factionId, change]) => {
                        const faction = this.getSave().factions[factionId];
                        if (!faction) return;

                        const newReputation = Math.max(0, Math.min(10, faction.reputation + change));

                        faction.reputation = newReputation;
                    
                        // If reputation reaches 0, deactivate faction
                        if (newReputation <= 0 && faction.active) {
                            faction.active = false;
                            this.pushToTimeline(save, `The ${faction.name} cut ties with the PARC.`);
                            // Remove any actors belonging to this faction from the PARC:
                            Object.values(save.actors).forEach(actor => {
                                if (actor.factionId === faction.id) {
                                    actor.locationId = faction.id; // move to faction location
                                }
                            });
                        } else if (newReputation >= 5 && !faction.module) {
                            // Generate a faction module, if not present
                            generateFactionModule(faction, this).then(moduleName => {
                                if (moduleName) {
                                    this.showPriorityMessage(`New module "${moduleName}" now available!`);
                                }
                            });
                        }
                    });
                // Handle special "STATION" id for station stat changes
                } else if (actorId === 'STATION') {
                    if (!save.stationStats) {
                        continue;
                    }
                    // Apply to save.stationStats; actorChanges is a map of stat name to change amount
                    for (const prop of Object.keys(actorChanges)) {
                        // Find matching station stat (case-insensitive)
                        for (const statKey of Object.keys(save.stationStats)) {
                            if (statKey.toLowerCase() === prop.toLowerCase() ||
                                statKey.toLowerCase().includes(prop.toLowerCase()) ||
                                prop.toLowerCase().includes(statKey.toLowerCase())) {
                                const currentValue = save.stationStats[statKey as StationStat];
                                save.stationStats[statKey as StationStat] = Math.max(1, Math.min(10, currentValue + actorChanges[prop]));
                                break;
                            }
                        }
                    }
                    continue;
                }
                
                const actor = save.actors[actorId];
                if (actor) {
                    // Apply to actor.stats; actorChanges is a map of stat name to change amount
                    for (const prop of Object.keys(actorChanges)) {
                        const stat = (prop as keyof typeof actor.stats);
                        actor.stats[stat] = Math.max(1, Math.min(10, actor.stats[stat] + actorChanges[prop]));
                    }
                }
            }

            // Look at all actors involved in the skit, and run updateCharacterArc on them:
            for (const actor of Object.values(save.actors)) {
                if (save.currentSkit?.script.some(entry => namesMatch(entry.speaker, actor.name) || entry.speaker === actor.id)) {
                    updateCharacterArc(this, save.currentSkit ?? {}, actor);
                }
                // Apply last location from skit movements:
                const lastMovementEntry = [...(save.currentSkit?.script || [])].reverse().find(entry => entry.movements && Object.keys(entry.movements).some(moverId => moverId === actor.id));
                if (lastMovementEntry && lastMovementEntry.movements) {
                    const newLocationId = lastMovementEntry.movements[actor.id];
                    if (newLocationId) {
                        actor.locationId = newLocationId;
                    }
                }

                const lastOutfitEntry = [...(save.currentSkit?.script || [])].reverse().find(entry => entry.outfitChanges && Object.keys(entry.outfitChanges).some(changerId => changerId === actor.id));
                if (lastOutfitEntry && lastOutfitEntry.outfitChanges) {
                    const newOutfitId = lastOutfitEntry.outfitChanges[actor.id];
                    if (newOutfitId && actor.outfits.some(outfit => outfit.id === newOutfitId)) {
                        actor.outfitId = newOutfitId;
                    }
                }
            }

            // Look at past skits (starting from the beginning), and find one that doesn't have a summary, to generate:
            const skitToSummarize = (save.timeline || []).find(entry => entry.skit && !entry.skit.summary)?.skit;
            if (skitToSummarize) {
                console.log(`Summarizing an old skit.`);
                generateSkitSummary(skitToSummarize, this).then(summary => {
                    if (summary) {
                        this.saveGame();
                    }
                });
            }

            save.currentSkit = undefined;
            this.incTurn(1, setScreenType);
        }
    }

    async continueSkit(): Promise<void> {
        const skit = (this.getSave() as any).currentSkit as SkitData;
        if (!skit) return;
        skit.generating = true;
        try {
            const { entries, endScene, statChanges } = await generateSkitScript(skit, this);
            skit.script.push(...entries);
        } catch (err) {
            console.error('Error continuing skit script', err);
        } finally {
            skit.generating = false;
        }
        return;
    }

    async uploadBlob(fileName: string, blob: Blob, propertyBag: BlobPropertyBag): Promise<string> {
        // Depth URL is the HF URL; back it up to Chub by creating a File from the image data:
        const file: File = new File([blob], fileName, propertyBag);
        return this.uploadFile(fileName, file);
    }

    async uploadFile(fileName: string, file: File): Promise<string> {
        // Don't honor file's name; want to overwrite existing content that may have had a different actual name.
        const updateResponse = await this.storage.set(fileName, file).forUser();
        if (!updateResponse.data || updateResponse.data.length == 0) {
            throw new Error('Failed to upload file to storage.');
        }
        return updateResponse.data[0].value;
    }

    pushToTimeline(save: SaveType, description: string, skit: SkitData | null = null) {
        if (!save.timeline) {
            save.timeline = [];
        }
        save.timeline.push({
            day: save.day,
            turn: save.turn,
            description: description,
            ...skit ? {skit: skit} : {}
        });
    }


    isVerticalLayout(): boolean {
        // Determine if the layout should be vertical based on window aspect ratio
        // Vertical layout when height > width (portrait orientation)
        return window.innerHeight > window.innerWidth;
    }

    render(): ReactElement {

        return <BaseScreen stage={() => this}/>;
    }

}
