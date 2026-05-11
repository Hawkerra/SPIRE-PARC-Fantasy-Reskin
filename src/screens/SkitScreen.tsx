/*
 * This screen displays Visual Novel skit scenes, displaying dialogue and characters as they interact with the player and each other.
 */
import React, { FC, useEffect } from 'react';
import { ScreenType } from './BaseScreen';
import { Module } from '../Module';
import Actor, { namesMatch, findBestNameMatch, isHologram } from '../actors/Actor';
import { Stage } from '../Stage';
import { SkitData } from '../Skit';
import ActorImage from '../actors/ActorImage';
import { Emotion } from '../actors/Emotion';
import SkitOutcomeDisplay from './SkitOutcomeDisplay';
import Nameplate from '../components/Nameplate';
import { BlurredBackground } from '../components/BlurredBackground';
import { useTooltip } from '../contexts/TooltipContext';
import ActorCard, { ActorCardSection } from '../components/ActorCard';

import {
    Box, 
    Button, 
    TextField, 
    Typography, 
    Paper,
    IconButton,
    Chip,
    CircularProgress
} from '@mui/material';
import {
    Send,
    Forward,
    Close,
    Casino,
    Computer,
    VolumeUp,
    VolumeOff,
    CardGiftcard,
    ChevronRight,
    ChevronLeft,
    Edit,
    Check,
    Clear
} from '@mui/icons-material';
import TypeOut from '../components/TypeOut';

// Base text shadow for non-dialogue text
const baseTextShadow = '2px 2px 2px rgba(0, 0, 0, 0.8)';

// Helper function to brighten a color for better visibility
const adjustColor = (color: string, amount: number = 0.6): string => {
    // Parse hex color
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Brighten by mixing with white
    const newR = Math.min(255, Math.round(r + (255 - r) * amount));
    const newG = Math.min(255, Math.round(g + (255 - g) * amount));
    const newB = Math.min(255, Math.round(b + (255 - b) * amount));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

    // Helper function to format text with dialogue, italics, and bold styling
// Accepts optional speaker actor to apply custom font and drop shadow
const formatMessage = (text: string, speakerActor?: Actor | null): JSX.Element => {
    if (!text) return <></>;

    // Replace directional quotes with standard quotes
    text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    
    // Split by dialogue (text in quotes) first
    const dialogueParts = text.split(/(\"[^"]*\")/g);
    
    
    return (
        <>
            {dialogueParts.map((part, index) => {
                // Check if this part is dialogue (wrapped in quotes)
                if (part.startsWith('"') && part.endsWith('"')) {
                    // Apply custom font and drop shadow to dialogue if speaker has custom properties
                    const brightenedColor = speakerActor?.themeColor 
                        ? adjustColor(speakerActor.themeColor, 0.6)
                        : '#87CEEB';
                    
                    const dialogueStyle: React.CSSProperties = { 
                        color: brightenedColor,
                        fontFamily: speakerActor?.themeFontFamily || undefined,
                        textShadow: speakerActor?.themeColor 
                            ? `2px 2px 2px ${adjustColor(speakerActor.themeColor, -0.25)}`
                            : '2px 2px 2px rgba(135, 206, 235, 0.5)'
                    };
                    return (
                        <span key={index} style={dialogueStyle}>
                            {formatInlineStyles(part)}
                        </span>
                    );
                } else {
                    return (
                        <span key={index} style={{ textShadow: baseTextShadow }}>
                            {formatInlineStyles(part)}
                        </span>
                    );
                }
            })}
        </>
    );
};

// Helper function to format bold, italic, underlined, strikethrough, subscript, and header texts, following markdown-like syntax
const formatInlineStyles = (text: string): JSX.Element => {
    if (!text) return <></>;

    const formatItalics = (text: string): JSX.Element => {
        
        // Process both * and _ for italics, but avoid ** (bold)
        const italicParts = text.split(/(\*(?!\*)[^*]+\*|_[^_]+_)/g);
        
        return (
            <>
                {italicParts.map((italicPart, italicIndex) => {
                    if ((italicPart.startsWith('*') && italicPart.endsWith('*') && !italicPart.startsWith('**')) ||
                        (italicPart.startsWith('_') && italicPart.endsWith('_'))) {
                        const italicText = italicPart.slice(1, -1); // Remove * or _
                        return <em key={italicIndex}>{italicText}</em>;
                    } else {
                        return italicPart;
                    }
                })}
            </>
        );
    }

    const formatBold = (text: string): JSX.Element => {
        const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
        
        return (
            <>
                {boldParts.map((boldPart, boldIndex) => {
                    if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                        const boldText = boldPart.slice(2, -2); // Remove **
                        return (
                            <strong key={boldIndex}>
                                {formatItalics(boldText)}
                            </strong>
                        );
                    } else {
                        return formatItalics(boldPart);
                    }
                })}
            </>
        );
    }

    const formatStrikethrough = (text: string): JSX.Element => {
        const strikeParts = text.split(/(~~[^~]+~~)/g);
        
        return (
            <>
                {strikeParts.map((strikePart, strikeIndex) => {
                    if (strikePart.startsWith('~~') && strikePart.endsWith('~~')) {
                        const strikeText = strikePart.slice(2, -2); // Remove ~~
                        return (
                            <s key={strikeIndex}>
                                {formatBold(strikeText)}
                            </s>
                        );
                    } else {
                        return formatBold(strikePart);
                    }
                })}
            </>
        );
    }

    const formatUnderline = (text: string): JSX.Element => {
        const underlineParts = text.split(/(__[^_]+__)/g);
        
        return (
            <>
                {underlineParts.map((underlinePart, underlineIndex) => {
                    if (underlinePart.startsWith('__') && underlinePart.endsWith('__')) {
                        const underlineText = underlinePart.slice(2, -2); // Remove __
                        return (
                            <u key={underlineIndex}>
                                {formatStrikethrough(underlineText)}
                            </u>
                        );
                    } else {
                        return formatStrikethrough(underlinePart);
                    }
                })}
            </>
        );
    }

    const formatSubscript = (text: string): JSX.Element => {
        const subscriptParts = text.split(/(~[^~]+~)/g);
        
        return (
            <>
                {subscriptParts.map((subPart, subIndex) => {
                    if (subPart.startsWith('~') && subPart.endsWith('~')) {
                        const subText = subPart.slice(1, -1); // Remove ~
                        return (
                            <sub key={subIndex}>
                                {formatUnderline(subText)}
                            </sub>
                        );
                    } else {
                        return formatUnderline(subPart);
                    }
                })}
            </>
        );
    }

    const formatHeaders = (text: string): JSX.Element => {
        const headerParts = text.split(/(#{1,6} [^\n]+)/g);
        
        return (
            <>
                {headerParts.map((headerPart, headerIndex) => {
                    if (headerPart.startsWith('#')) {
                        const headerText = headerPart.replace(/^#{1,6} /, ''); // Remove leading #s and space
                        const level = headerPart.match(/^#{1,6}/)?.[0].length || 1;
                        switch (level) {
                            case 1:
                                return <h1 key={headerIndex}>{formatSubscript(headerText)}</h1>;
                            case 2:
                                return <h2 key={headerIndex}>{formatSubscript(headerText)}</h2>;
                            case 3:
                                return <h3 key={headerIndex}>{formatSubscript(headerText)}</h3>;
                            case 4:
                                return <h4 key={headerIndex}>{formatSubscript(headerText)}</h4>;
                            case 5:
                                return <h5 key={headerIndex}>{formatSubscript(headerText)}</h5>;
                            case 6:
                                return <h6 key={headerIndex}>{formatSubscript(headerText)}</h6>;
                            default:
                                return <span key={headerIndex}>{formatSubscript(headerText)}</span>;
                        }
                    } else {
                        return formatSubscript(headerPart);
                    }
                })}
            </>
        );
    }

    return formatHeaders(text);
};

interface SkitScreenProps {
    stage: () => Stage;
    setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

/**
 * Helper function to get the active scene module ID at a given script index.
 * Applies scene-level module transitions up to and including the index.
 */
const getSceneModuleIdAtIndex = (skit: SkitData, scriptIndex: number): string => {
    let sceneModuleId = skit.moduleId;

    for (let i = 0; i <= scriptIndex && i < skit.script.length; i++) {
        const entry = skit.script[i];
        if (entry.moveToModuleId) {
            sceneModuleId = entry.moveToModuleId;
        }
    }

    return sceneModuleId;
};

/**
 * Helper function to get the actors present in the scene at a given script index.
 * Walks through movements from initialActorLocations, filtering by scene module at index.
 */
const getActorsAtIndex = (skit: SkitData, scriptIndex: number, allActors: {[key: string]: Actor}): Actor[] => {
    // Start with initial actor locations
    const currentLocations = {...(skit.initialActorLocations || {})};
    
    // Apply movements up to and including the current index
    for (let i = 0; i <= scriptIndex && i < skit.script.length; i++) {
        const entry = skit.script[i];
        if (entry.movements) {
            Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                currentLocations[actorId] = newLocationId;
            });
        }
    }
    
    const sceneModuleId = getSceneModuleIdAtIndex(skit, scriptIndex);

    // Filter actors who are at the skit's module
    const actorsAtModule: Actor[] = [];
    Object.entries(currentLocations).forEach(([actorId, locationId]) => {
        if (locationId === sceneModuleId && allActors[actorId]) {
            actorsAtModule.push(allActors[actorId]);
        }
    });
    
    return actorsAtModule;
};

/**
 * Helper function to get actor outfit IDs at a given script index.
 * Walks from initialActorOutfits and applies per-entry outfitChanges.
 */
const getActorOutfitsAtIndex = (skit: SkitData, scriptIndex: number, allActors: {[key: string]: Actor}): {[actorId: string]: string} => {
    const currentOutfits = {
        ...Object.values(allActors).reduce((acc, actor) => {
            acc[actor.id] = actor.outfitId;
            return acc;
        }, {} as {[actorId: string]: string}),
        ...(skit.initialActorOutfits || {})
    };

    for (let i = 0; i <= scriptIndex && i < skit.script.length; i++) {
        const entry = skit.script[i];
        if (entry.outfitChanges) {
            Object.entries(entry.outfitChanges).forEach(([actorId, newOutfitId]) => {
                currentOutfits[actorId] = newOutfitId;
            });
        }
    }

    return currentOutfits;
};

/**
 * Helper function to calculate the X position for an actor based on their index in the scene.
 * Actors alternate between left and right sides of the screen, with positions distributed
 * within ranges centered at 25vw (left) and 75vw (right).
 */
const calculateActorXPosition = (actorIndex: number, totalActors: number, anySpeaker: boolean): number => {
    const leftRange = Math.min(40, Math.ceil((totalActors - 2) / 2) * 20); // Adjust used screen space by number of present actors.
    const rightRange = Math.min(40, Math.floor((totalActors - 2) / 2) * 20);
    const leftSide = (actorIndex % 2) === 0;
    const indexOnSide = leftSide ? Math.floor(actorIndex / 2) : Math.floor((actorIndex - 1) / 2);
    const actorsOnSide = leftSide ? Math.ceil(totalActors / 2) : Math.floor(totalActors / 2);
    const range = leftSide ? leftRange : rightRange;
    const increment = actorsOnSide > 1 ? (indexOnSide / (actorsOnSide - 1)) : 0.5;
    const center = leftSide ? (anySpeaker ? 25 : 30) : (anySpeaker ? 75 : 70);
    const xPosition = totalActors === 1 ? 50 : Math.round(increment * range) + (center - Math.floor(range / 2));
    
    return xPosition;
};

export const SkitScreen: FC<SkitScreenProps> = ({ stage, setScreenType, isVerticalLayout }) => {
    const { setTooltip, clearTooltip } = useTooltip();
    const typeOutSpeed = Math.max(0, stage().getSave().typeOutSpeed ?? stage().DEFAULT_TYPE_OUT_SPEED);
    const [index, setIndex] = React.useState<number>(0);
    const [inputText, setInputText] = React.useState<string>('');
    const [sceneEnded, setSceneEnded] = React.useState<boolean>(false);
    const [skit, setSkit] = React.useState<SkitData>(stage().getSave().currentSkit as SkitData);
    const [loading, setLoading] = React.useState<boolean>(false);
    const [speaker, setSpeaker] = React.useState<Actor|null>(null);
    const [displayName, setDisplayName] = React.useState<string>('');
    const [displayMessage, setDisplayMessage] = React.useState<JSX.Element>(<></>);
    const [finishTyping, setFinishTyping] = React.useState<boolean>(false);
    const [messageKey, setMessageKey] = React.useState<number>(0); // Key to force TypeOut reset
    const [hoveredActor, setHoveredActor] = React.useState<Actor | null>(null);
    const [audioEnabled, setAudioEnabled] = React.useState<boolean>(true);
    const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const prevIndexRef = React.useRef<number>(index);
    const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);
    const messageBoxRef = React.useRef<HTMLDivElement>(null);
    const [messageBoxTopVh, setMessageBoxTopVh] = React.useState<number>(isVerticalLayout ? 50 : 60);
    const [isEditingMessage, setIsEditingMessage] = React.useState<boolean>(false);
    const [editedMessage, setEditedMessage] = React.useState<string>('');
    const [originalMessage, setOriginalMessage] = React.useState<string>('');

    // Measure message box position
    React.useEffect(() => {
        const updateMessageBoxPosition = () => {
            if (messageBoxRef.current) {
                const rect = messageBoxRef.current.getBoundingClientRect();
                const topVh = (rect.top / window.innerHeight) * 100;
                setMessageBoxTopVh(topVh);
            }
        };
        
        // Update on mount and layout changes
        updateMessageBoxPosition();
        
        // Update on window resize
        window.addEventListener('resize', updateMessageBoxPosition);
        
        return () => window.removeEventListener('resize', updateMessageBoxPosition);
    }, [isVerticalLayout, skit]);

    // Handle mouse move to update hover state based on proximity to actor positions
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const x = (e.clientX / window.innerWidth) * 100; // Convert to vw
        const y = (e.clientY / window.innerHeight) * 100; // Convert to vh
        setMousePosition({ x, y });
    };

    // Calculate which actor should be hovered based on mouse proximity
    React.useEffect(() => {
        if (!mousePosition) {
            setHoveredActor(null);
            return;
        }

        // Don't show hover when over the message box area (bottom portion of screen)
        if (mousePosition.y > messageBoxTopVh) {
            setHoveredActor(null);
            return;
        }

        // Get current actors and their positions
        const actors = getActorsAtIndex(skit, index, stage().getSave().actors);
        if (actors.length === 0) {
            setHoveredActor(null);
            return;
        }

        // Calculate actor positions using shared logic
        const actorPositions = actors.map((actor, i) => ({
            actor,
            xPosition: calculateActorXPosition(i, actors.length, speaker !== null)
        }));

        // Find closest actor within 10vw range
        const HOVER_RANGE = 10; // vw
        let closestActor: Actor | null = null;
        let closestDistance = Infinity;

        actorPositions.forEach(({ actor, xPosition }) => {
            // use 50 as xPosition if the actor is the current speaker
            const distance = Math.abs(mousePosition.x - (actor === speaker ? 50 : xPosition));
            if (distance < closestDistance && distance <= HOVER_RANGE) {
                closestDistance = distance;
                closestActor = actor;
            }
        });

        setHoveredActor(closestActor);
    }, [mousePosition, index, skit, isVerticalLayout]);

    // If audioEnabled changes to false, stop any currently playing audio
    useEffect(() => {
        if (!audioEnabled && currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
        }
    }, [audioEnabled]);

    // Update actor locationIds when navigating through the skit
    useEffect(() => {
        if (!skit.initialActorLocations) return;
        
        // Start with initial locations
        const currentLocations = {...skit.initialActorLocations};
        
        // Apply movements up to and including the current index
        for (let i = 0; i <= index && i < skit.script.length; i++) {
            const entry = skit.script[i];
            if (entry.movements) {
                Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                    currentLocations[actorId] = newLocationId;
                });
            }
        }
        
        // Update actual actor locationIds in the save data
        Object.entries(currentLocations).forEach(([actorId, locationId]) => {
            const actor = stage().getSave().actors[actorId];
            if (actor && !actor.isOffSite(stage().getSave())) {
                actor.locationId = locationId;
            }
        });

        const currentOutfits = getActorOutfitsAtIndex(skit, index, stage().getSave().actors);
        Object.entries(currentOutfits).forEach(([actorId, outfitId]) => {
            const actor = stage().getSave().actors[actorId];
            if (actor && actor.outfits.some(outfit => outfit.id === outfitId)) {
                actor.outfitId = outfitId;
            }
        });
    }, [index, skit, stage]);

    // Handle arrow key navigation globally (when input is not focused or is empty)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            try {
                const target = e.target as HTMLElement;
                const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
                
                // Only handle arrow keys if input is not focused OR input is empty
                if (e.key === 'ArrowLeft' && !isEditingMessage && (!isInputFocused || inputText.trim() === '')) {
                    e.preventDefault();
                    prev();
                } else if (e.key === 'ArrowRight' && !isEditingMessage && (!isInputFocused || inputText.trim() === '')) {
                    e.preventDefault();
                    next();
                }
            } catch (error) {
                console.error('Error in keydown handler:', error);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [inputText, index, skit, finishTyping, loading, isEditingMessage]);

    useEffect(() => {
        if (skit.script.length == 0) {
            setLoading(true);
            stage().continueSkit().then(() => {
                setSkit({...stage().getSave().currentSkit as SkitData});
                setLoading(false);
                const skitData = stage().getSave().currentSkit;
                // Check if the final entry has endScene
                const ended = skitData?.script[skitData.script.length - 1]?.endScene || false;
                setSceneEnded(ended);
            });
        }
    }, [skit]);

    useEffect(() => {
        if (skit.script && skit.script.length > 0) {
            const currentSpeakerName = skit.script[index]?.speaker?.trim() || '';
            const actors = Object.values(stage().getSave().actors);
            const matchingActor = findBestNameMatch(currentSpeakerName, actors);
            
            // Check if this is the player speaking
            const playerName = stage().getSave().player.name;
            const isPlayerSpeaker = !matchingActor && playerName && namesMatch(playerName.trim().toLowerCase(), currentSpeakerName.toLowerCase());
            
            // Reset typing state BEFORE setting new message to prevent flash of full content
            // Only reset if the index has changed. Also handle audio playback here, to ensure it doesn't redundantly play when setting index to the current index.
            if (prevIndexRef.current !== index) {
                setFinishTyping(false);
                // Exit edit mode when navigating to a different message
                if (isEditingMessage) {
                    setIsEditingMessage(false);
                    setOriginalMessage('');
                }
                if (currentAudioRef.current) {
                    // Stop any currently playing audio
                    currentAudioRef.current.pause();
                    currentAudioRef.current.currentTime = 0;
                }
                if (audioEnabled && skit.script[index]?.speechUrl) {
                    const audio = new Audio(skit.script[index].speechUrl);
                    currentAudioRef.current = audio;
                    audio.play().catch(err => {
                        console.error('Error playing audio:', err);
                    });
                }
                prevIndexRef.current = index;
            }
            setMessageKey(prev => prev + 1); // Increment key to force fresh TypeOut mount
            setSpeaker(matchingActor || null);
            setDisplayName(matchingActor?.name || (isPlayerSpeaker ? playerName : ''));
            setDisplayMessage(formatMessage(skit.script[index]?.message || '', matchingActor));

        } else {
            setSpeaker(null);
            setDisplayName('');
            setDisplayMessage(<></>);
            setFinishTyping(false);
        }
        
        // Update sceneEnded based on current index
        if (skit.script[index]?.endScene) {
            setSceneEnded(true);
        } else {
            setSceneEnded(false);
        }

    }, [index, skit]);

    const next = () => {
        if (isEditingMessage) {
            handleConfirmEdit();
        }
        if (finishTyping) {
            setIndex(prevIndex => Math.min(prevIndex + 1, skit.script.length - 1));
        } else {
            setFinishTyping(true);
        }
    };

    const prev = () => {
        if (isEditingMessage) {
            handleConfirmEdit();
        }
        setIndex(prevIndex => Math.max(prevIndex - 1, 0));
    };

    const renderActors = (module: Module | null, actors: Actor[], currentSpeaker?: string) => {
        // Display actors centered across the scene bottom. Use emotion from current script entry or neutral as fallback
        const actorOutfitsAtIndex = getActorOutfitsAtIndex(skit, index, stage().getSave().actors);
        return actors.map((actor, i) => {
            
            // Get emotion for this actor from current script entry
            let emotion = Emotion.neutral;
            
            if (skit.script && skit.script.length > 0 && index < skit.script.length) {
                // scan backward through skit script to find most recent emotion for this actor:
                for (let j = index; j >= 0; j--) {
                    const entry = skit.script[j];
                    if (entry.actorEmotions && entry.actorEmotions[actor.name]) {
                        emotion = entry.actorEmotions[actor.name];
                        break;
                    }
                }
            }
            
            const xPosition = calculateActorXPosition(i, actors.length, speaker !== null);
            const isSpeaking = actor === speaker;
            const isHovered = hoveredActor === actor;
            const outfitId = actorOutfitsAtIndex[actor.id] || actor.outfitId;
            
            return (
                <ActorImage
                    key={actor.id}
                    actor={actor}
                    emotion={emotion}
                    imageUrl={actor.getEmotionImage(emotion, stage(), outfitId)}
                    hologram={isHologram(actor, stage().getSave(), module ? module.id || '' : '')}
                    xPosition={xPosition}
                    yPosition={isVerticalLayout ? 20 : 0}
                    zIndex={50 - Math.abs(xPosition - 50)}
                    heightMultiplier={isVerticalLayout ? (isSpeaking ? 0.9 : 0.7) : 1.0}
                    speaker={isSpeaking}
                    highlightColor={isHovered ? "rgba(255,255,255,0)" : "rgba(225,225,225,0)"}
                    panX={0}
                    panY={0}
                />
            );
        });
    }



    const currentSceneModuleId = getSceneModuleIdAtIndex(skit, index);
    const module = stage().getSave().layout.getModuleById(currentSceneModuleId || '');
    const decorImageUrl = module ? stage().getSave().actors[module.ownerId || '']?.decorImageUrls[module.type] || module.getAttribute('defaultImageUrl') : '';

    return (
        <BlurredBackground
            imageUrl={decorImageUrl}
        >
            <div 
                style={{ position: 'relative', width: '100vw', height: '100vh' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setMousePosition(null)}
            >

            {/* Actors */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                {renderActors(module, getActorsAtIndex(skit, index, stage().getSave().actors), skit.script && skit.script.length > 0 ? skit.script[index]?.speaker : undefined)}
            </div>

            {/* Skit Outcome Display - shown when scene ends */}
            {sceneEnded && index === skit.script.length - 1 && (
                <SkitOutcomeDisplay skitData={skit} stage={stage()} layout={stage().getSave().layout} messageBoxTopVh={messageBoxTopVh} inputText={inputText} />
            )}

            {/* Actor Card - shown when hovering over an actor, only if no outcome is displayed */}
            {hoveredActor && !(sceneEnded && index === skit.script.length - 1) && (
                <div style={{
                    position: 'absolute',
                    top: isVerticalLayout ? '2%' : '5%',
                    right: isVerticalLayout ? '2%' : '5%',
                    width: isVerticalLayout ? '35vw' : '15vw',
                    height: '30vh',
                    zIndex: 3
                }}>
                    <ActorCard
                        actor={hoveredActor}
                        visitingFaction={undefined /* Don't display visiting status in skits. */}
                        role={hoveredActor.getRole(stage().getSave())}
                        collapsedSections={[ActorCardSection.STATS]}
                    />
                </div>
            )}

            {/* Bottom text window */}
            <Paper
                ref={messageBoxRef}
                elevation={8}
                sx={{ 
                    position: 'absolute', 
                    left: isVerticalLayout ? '2%' : '5%', 
                    right: isVerticalLayout ? '2%' : '5%',
                    bottom: isVerticalLayout ? '1%' : '4%', 
                    background: 'rgba(10,20,30,0.95)', 
                    border: '2px solid rgba(0,255,136,0.12)', 
                    borderRadius: 3,
                    p: 2,
                    color: '#e8fff0', 
                    zIndex: 2,
                    backdropFilter: 'blur(8px)',
                    minHeight: isVerticalLayout ? '20vh' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}
            >
                {/* Navigation and speaker section */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: isVerticalLayout ? 1 : 2 }}>
                    <Box sx={{ display: 'flex', gap: isVerticalLayout ? 0.5 : 1.5, alignItems: 'center', flex: 1 }}>
                        <IconButton 
                            onClick={prev} 
                            disabled={index === 0 || loading}
                            size="small"
                            sx={{ 
                                color: '#cfe', 
                                border: '1px solid rgba(255,255,255,0.08)',
                                padding: isVerticalLayout ? '4px' : undefined,
                                minWidth: isVerticalLayout ? '28px' : undefined,
                                '&:disabled': { color: 'rgba(255,255,255,0.3)' }
                            }}
                        >
                            <ChevronLeft fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '14px' : undefined }} />
                        </IconButton>

                        {/* Progress indicator */}
                        <Chip
                            label={loading ? 
                                <CircularProgress size={isVerticalLayout ? 12 : 16} sx={{ color: '#bfffd0' }} 
                                    onMouseEnter={() => {
                                        setTooltip('Awaiting content from the LLM', Computer);
                                    }}
                                    onMouseLeave={() => {
                                        clearTooltip();
                                    }}
                                /> : 
                                <span style={{ display: 'flex', alignItems: 'center', gap: isVerticalLayout ? '2px' : '4px' }}>
                                    {index + 1 < skit.script.length && inputText.length > 0 && (
                                        <span 
                                            style={{ 
                                                color: '#ffaa00',
                                                fontSize: isVerticalLayout ? '0.9em' : '1.1em',
                                                fontWeight: 900
                                            }}
                                            title="Sending input will replace subsequent messages"
                                        >
                                            ⚠
                                        </span>
                                    )}
                                    {`${index + 1} / ${skit.script.length}`}
                                </span>
                            }
                            sx={{ 
                                minWidth: isVerticalLayout ? 50 : 72,
                                height: isVerticalLayout ? '24px' : undefined,
                                fontSize: isVerticalLayout ? '0.7rem' : undefined,
                                fontWeight: 700, 
                                color: (index + 1 < skit.script.length && inputText.length > 0) ? '#ffdd99' : '#bfffd0', 
                                background: (index + 1 < skit.script.length && inputText.length > 0) ? 'rgba(255,170,0,0.08)' : 'rgba(255,255,255,0.02)', 
                                border: (index + 1 < skit.script.length && inputText.length > 0) ? '1px solid rgba(255,170,0,0.2)' : '1px solid rgba(255,255,255,0.03)',
                                transition: 'all 0.3s ease',
                                '& .MuiChip-label': {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: isVerticalLayout ? 0.25 : 0.5,
                                    padding: isVerticalLayout ? '0 6px' : undefined
                                }
                            }}
                        />

                        <IconButton 
                            onClick={next} 
                            disabled={index === skit.script.length - 1 || loading}
                            size="small"
                            sx={{ 
                                color: '#cfe', 
                                border: '1px solid rgba(255,255,255,0.08)',
                                padding: isVerticalLayout ? '4px' : undefined,
                                minWidth: isVerticalLayout ? '28px' : undefined,
                                '&:disabled': { color: 'rgba(255,255,255,0.3)' }
                            }}
                        >
                            <ChevronRight fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '14px' : undefined }} />
                        </IconButton>

                        {/* Speaker name */}
                        {displayName && speaker && (
                            <Nameplate 
                                actor={speaker} 
                                size={isVerticalLayout ? "medium" : "large"}
                                role={(() => {
                                    const roleModules = stage().getSave().layout.getModulesWhere((m: any) => 
                                        m && m.type !== 'quarters' && m.ownerId === speaker.id
                                    );
                                    return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
                                })()}
                                layout="inline"
                            />
                        )}
                        {displayName && !speaker && (
                            <Nameplate 
                                name={displayName}
                                size={isVerticalLayout ? "medium" : "large"}
                                layout="inline"
                            />
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: isVerticalLayout ? 0.5 : 1.5, alignItems: 'center' }}>
                        {/* Audio toggle button */}
                        <IconButton
                            onClick={() => { 
                                if (isEditingMessage) {
                                    handleConfirmEdit();
                                }
                                if (stage().getSave().disableTextToSpeech) return; 
                                setAudioEnabled(!audioEnabled); 
                            }}
                            onMouseEnter={() => {
                                setTooltip(stage().getSave().disableTextToSpeech ? 'Speech generation is disabled in settings' : (audioEnabled ? 'Disable speech audio' : 'Enable speech audio'),
                                    (stage().getSave().disableTextToSpeech || !audioEnabled) ? VolumeOff : VolumeUp);
                            }}
                            onMouseLeave={() => {
                                clearTooltip();
                            }}
                            size="small"
                            sx={{
                                color: stage().getSave().disableTextToSpeech ? '#888888' : (audioEnabled ? '#00ff88' : '#ff6b6b'),
                                border: `1px solid ${audioEnabled ? 'rgba(0,255,136,0.2)' : 'rgba(255,107,107,0.2)'}`,
                                padding: isVerticalLayout ? '4px' : undefined,
                                minWidth: isVerticalLayout ? '28px' : undefined,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    borderColor: audioEnabled ? 'rgba(0,255,136,0.4)' : 'rgba(255,107,107,0.4)',
                                    color: audioEnabled ? '#00ffaa' : '#ff5252',
                                }
                            }}
                        >
                            {(stage().getSave().disableTextToSpeech || !audioEnabled) ? <VolumeOff fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '16px' : undefined }} /> : <VolumeUp fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '16px' : undefined }} />}
                        </IconButton>

                        {/* Edit mode buttons */}
                        {!isEditingMessage ? (
                            <IconButton
                                onClick={() => {
                                    handleEnterEditMode();
                                }}
                                onMouseEnter={() => {
                                    setTooltip('Edit message', Edit);
                                }}
                                onMouseLeave={() => {
                                    clearTooltip();
                                }}
                                disabled={loading}
                                size="small"
                                sx={{
                                    color: '#00ff88',
                                    border: '1px solid rgba(0,255,136,0.2)',
                                    padding: isVerticalLayout ? '4px' : undefined,
                                    minWidth: isVerticalLayout ? '28px' : undefined,
                                    opacity: 1,
                                    transform: 'scale(1)',
                                    transition: 'all 0.3s ease',
                                    animation: 'fadeIn 0.3s ease',
                                    '@keyframes fadeIn': {
                                        from: {
                                            opacity: 0,
                                            transform: 'scale(0.8)',
                                        },
                                        to: {
                                            opacity: 1,
                                            transform: 'scale(1)',
                                        },
                                    },
                                    '&:hover': {
                                        borderColor: 'rgba(0,255,136,0.4)',
                                        color: '#00ffaa',
                                    },
                                    '&:disabled': { color: 'rgba(255,255,255,0.3)' }
                                }}
                            >
                                <Edit fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '16px' : undefined }} />
                            </IconButton>
                        ) : (
                            <>
                                {/* Confirm edit button */}
                                <IconButton
                                    onClick={() => {
                                        handleConfirmEdit();
                                    }}
                                    onMouseEnter={() => {
                                        setTooltip('Confirm changes', Check);
                                    }}
                                    onMouseLeave={() => {
                                        clearTooltip();
                                    }}
                                    size="small"
                                    sx={{
                                        color: '#00ff88',
                                        border: '1px solid rgba(0,255,136,0.2)',
                                        padding: isVerticalLayout ? '4px' : undefined,
                                        minWidth: isVerticalLayout ? '28px' : undefined,
                                        opacity: 1,
                                        transform: 'scale(1)',
                                        transition: 'all 0.3s ease',
                                        animation: 'fadeIn 0.3s ease',
                                        '@keyframes fadeIn': {
                                            from: {
                                                opacity: 0,
                                                transform: 'scale(0.8)',
                                            },
                                            to: {
                                                opacity: 1,
                                                transform: 'scale(1)',
                                            },
                                        },
                                        '&:hover': {
                                            borderColor: 'rgba(0,255,136,0.4)',
                                            color: '#00ffaa',
                                        }
                                    }}
                                >
                                    <Check fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '16px' : undefined }} />
                                </IconButton>
                                {/* Cancel edit button */}
                                <IconButton
                                    onClick={() => {
                                        handleCancelEdit();
                                    }}
                                    onMouseEnter={() => {
                                        setTooltip('Cancel changes', Clear);
                                    }}
                                    onMouseLeave={() => {
                                        clearTooltip();
                                    }}
                                    size="small"
                                    sx={{
                                        color: '#ff6b6b',
                                        border: '1px solid rgba(255,107,107,0.2)',
                                        padding: isVerticalLayout ? '4px' : undefined,
                                        minWidth: isVerticalLayout ? '28px' : undefined,
                                        opacity: 1,
                                        transform: 'scale(1)',
                                        transition: 'all 0.3s ease',
                                        animation: 'fadeIn 0.3s ease',
                                        '@keyframes fadeIn': {
                                            from: {
                                                opacity: 0,
                                                transform: 'scale(0.8)',
                                            },
                                            to: {
                                                opacity: 1,
                                                transform: 'scale(1)',
                                            },
                                        },
                                        '&:hover': {
                                            borderColor: 'rgba(255,107,107,0.4)',
                                            color: '#ff5252',
                                        }
                                    }}
                                >
                                    <Clear fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '16px' : undefined }} />
                                </IconButton>
                            </>
                        )}

                        {/* Re-roll button */}
                        <IconButton
                            onClick={() => {
                                console.log('Re-roll clicked');
                                if (isEditingMessage) {
                                    handleConfirmEdit();
                                }
                                handleReroll();
                            }}
                            onMouseEnter={() => {
                                setTooltip('Re-generate events from this point', Casino);
                            }}
                            onMouseLeave={() => {
                                clearTooltip();
                            }}
                            disabled={loading}
                            size="small"
                            sx={{
                                color: '#00ff88',
                                border: '1px solid rgba(0,255,136,0.2)',
                                padding: isVerticalLayout ? '4px' : undefined,
                                minWidth: isVerticalLayout ? '28px' : undefined,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    borderColor: 'rgba(0,255,136,0.4)',
                                    color: '#00ffaa',
                                    transform: 'rotate(180deg)',
                                },
                                '&:disabled': { color: 'rgba(255,255,255,0.3)' }
                            }}
                        >
                            <Casino fontSize={isVerticalLayout ? 'inherit' : 'small'} sx={{ fontSize: isVerticalLayout ? '16px' : undefined }} />
                        </IconButton>
                    </Box>
                </Box>

                {/* Message content */}
                <Box 
                    sx={{ 
                        minHeight: '4rem', 
                        cursor: isEditingMessage ? 'text' : 'pointer',
                        borderRadius: 1,
                        transition: 'background-color 0.2s ease',
                        '&:hover': {
                            backgroundColor: isEditingMessage ? 'transparent' : 'rgba(255,255,255,0.02)'
                        }
                    }}
                    onClick={() => {
                        if (!isEditingMessage && !loading) {
                            if (!finishTyping) {
                                // Force typing to complete immediately
                                setFinishTyping(true);
                            } else {
                                // Already finished typing, advance to next message
                                next();
                            }
                        }
                    }}
                >
                    {isEditingMessage ? (
                        <TextField
                            fullWidth
                            multiline
                            value={editedMessage}
                            onChange={(e) => setEditedMessage(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    handleConfirmEdit();
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEdit();
                                }
                            }}
                            sx={{
                                '& .MuiInputBase-root': {
                                    fontSize: isVerticalLayout ? 'clamp(0.75rem, 2vw, 1.18rem)' : '1.18rem',
                                    lineHeight: 1.55,
                                    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
                                    color: '#e9fff7',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    padding: '8px',
                                },
                                '& .MuiInputBase-input': {
                                    padding: 0,
                                }
                            }}
                        />
                    ) : (
                        <Typography
                            variant="body1"
                            sx={{
                                fontSize: isVerticalLayout ? 'clamp(0.75rem, 2vw, 1.18rem)' : '1.18rem',
                                lineHeight: 1.55,
                                fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
                                color: '#e9fff7',
                                textShadow: baseTextShadow,
                            }}
                        >
                            {skit.script && skit.script.length > 0 ? (
                                <TypeOut
                                    key={messageKey}
                                    speed={typeOutSpeed}
                                    finishTyping={typeOutSpeed <= 0 || finishTyping}
                                    onTypingComplete={() => setFinishTyping(true)}
                                >
                                    {displayMessage}
                                </TypeOut>
                            ) : ''}
                        </Typography>
                    )}
                </Box>

                {/* Chat input */}
                <Box sx={{ display: 'flex', gap: isVerticalLayout ? 0.5 : 1.5, alignItems: 'center' }}>
                    <TextField
                        fullWidth
                        value={inputText}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!loading) {
                                    if (sceneEnded && inputText.trim() === '') {
                                        handleClose();
                                    } else {
                                        // If input is blank, progress the script; otherwise submit input
                                        if (inputText.trim() === '' && index < skit.script.length) {
                                            next();
                                        } else {
                                            handleSubmit();
                                        }
                                    }
                                }
                            }
                        }}
                        placeholder={
                            sceneEnded 
                                ? 'Continue typing to defer this outcome...' 
                                : (loading ? 'Generating...' : 'Type your course of action...')
                        }
                        disabled={loading}
                        variant="outlined"
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                                color: '#eafff2',
                                fontSize: isVerticalLayout ? '0.75rem' : undefined,
                                '& fieldset': {
                                    borderColor: 'rgba(255,255,255,0.08)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255,255,255,0.12)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'rgba(0,255,136,0.3)',
                                },
                                '&.Mui-disabled': {
                                    color: 'rgba(255,255,255,0.6)',
                                    '& fieldset': {
                                        borderColor: 'rgba(255,255,255,0.04)',
                                    },
                                },
                            },
                            '& .MuiInputBase-input': {
                                padding: isVerticalLayout ? '6px 8px' : undefined,
                            },
                            '& .MuiInputBase-input::placeholder': {
                                color: 'rgba(255,255,255,0.5)',
                                opacity: 1,
                                fontSize: isVerticalLayout ? '0.75rem' : undefined,
                            },
                            '& .MuiInputBase-input.Mui-disabled::placeholder': {
                                color: 'rgba(255,255,255,0.4)',
                                opacity: 1,
                            },
                            '& .MuiInputBase-input.Mui-disabled': {
                                color: 'rgba(255,255,255,0.45)',
                                WebkitTextFillColor: 'rgba(255,255,255,0.45)',
                            },
                        }}
                    />
                    <Button
                        onClick={() => { if (sceneEnded && !inputText.trim()) handleClose(); else handleSubmit(); }}
                        disabled={loading}
                        variant="contained"
                        startIcon={sceneEnded && !inputText.trim() ? <Close fontSize={isVerticalLayout ? 'small' : undefined} /> : (inputText.trim() ? <Send fontSize={isVerticalLayout ? 'small' : undefined} /> : <Forward fontSize={isVerticalLayout ? 'small' : undefined} />)}
                        sx={{
                            background: sceneEnded && !inputText.trim()
                                ? 'linear-gradient(90deg,#ff8c66,#ff5a3b)'
                                : 'linear-gradient(90deg,#00ff88,#00b38f)',
                            color: sceneEnded && !inputText.trim() ? '#fff' : '#00221a',
                            fontWeight: 800,
                            minWidth: isVerticalLayout ? 76 : 100,
                            fontSize: isVerticalLayout ? 'clamp(0.6rem, 2vw, 0.875rem)' : undefined,
                            padding: isVerticalLayout ? '4px 10px' : undefined,
                            '&:hover': {
                                background: sceneEnded && !inputText.trim()
                                    ? 'linear-gradient(90deg,#ff7a52,#ff4621)'
                                    : 'linear-gradient(90deg,#00e67a,#009a7b)',
                            },
                            '&:disabled': {
                                background: 'rgba(255,255,255,0.04)',
                                color: 'rgba(255,255,255,0.3)',
                            }
                        }}
                    >
                        {sceneEnded && !inputText.trim() ? 'End' : (inputText.trim() ? 'Send' : 'Continue')}
                    </Button>
                </Box>
            </Paper>
            </div>
        </BlurredBackground>
    );

    // Helper function to clear end node state when continuing from an end node
    function clearEndNodeState(stageSkit: SkitData, scriptIndex: number) {
        if (stageSkit.script[scriptIndex]?.endScene) {
            stageSkit.script[scriptIndex].endScene = false;
            stageSkit.summary = undefined;
            stageSkit.endProperties = undefined;
            stageSkit.endFactionChanges = undefined;
            stageSkit.endRoleChanges = undefined;
            stageSkit.endNewModule = undefined;
            stageSkit.endNewAppearances = undefined;
            setSceneEnded(false);
        }
    }

    // Handle entering edit mode
    function handleEnterEditMode() {
        if (skit.script && skit.script.length > 0 && skit.script[index]) {
            const currentMessage = skit.script[index].message || '';
            setOriginalMessage(currentMessage);
            setEditedMessage(currentMessage);
            setIsEditingMessage(true);
        }
    }

    // Handle confirming edit
    function handleConfirmEdit() {
        if (skit.script && skit.script.length > 0 && skit.script[index]) {
            // Update the message in the skit
            const stageSkit = stage().getSave().currentSkit;
            if (stageSkit && stageSkit.script[index]) {
                stageSkit.script[index].message = editedMessage;
                // Update display
                setSkit({...stageSkit});
                const actors = Object.values(stage().getSave().actors);
                const currentSpeakerName = stageSkit.script[index]?.speaker?.trim() || '';
                const matchingActor = findBestNameMatch(currentSpeakerName, actors);
                setDisplayMessage(formatMessage(editedMessage, matchingActor));
            }
        }
        setIsEditingMessage(false);
        setOriginalMessage('');
    }

    // Handle canceling edit
    function handleCancelEdit() {
        setEditedMessage(originalMessage);
        setIsEditingMessage(false);
        setOriginalMessage('');
    }

    // Handle reroll
    function handleReroll() {
        const stageSkit = stage().getSave().currentSkit;
        if (!stageSkit) return;
        // Cut out this index through the end of the script and re-generate:
        stageSkit.script = stageSkit.script.slice(0, index);
        // Clear end node state; index is always the final node after truncation above.
        if (index > 0) {
            clearEndNodeState(stageSkit, index - 1);
        }
        setLoading(true);
        setInputText('');
        stage().continueSkit().then(() => {
            const skitData = stage().getSave().currentSkit;
            setSkit({...skitData as SkitData});
            const newIndex = Math.min(index, (skitData?.script.length || 1) - 1);
            setIndex(newIndex);
            setLoading(false);
            // Check if the entry at new index has endScene
            const ended = skitData?.script[newIndex]?.endScene || false;
            setSceneEnded(ended);
        });
    }
    
    // Handle submission of player's guidance (or blank submit to continue the scene autonomously)
    function handleSubmit() {
        // Confirm any pending edits before submitting
        if (isEditingMessage) {
            handleConfirmEdit();
        }
        
        // Truncate the script at the current index and add input text as a player speaker action:
        const stageSkit = stage().getSave().currentSkit;
        if (!stageSkit) return;
        
        if (!inputText.trim() && index < stageSkit.script.length - 1) {
            next();
            return;
        }

        // Truncate script to current index (removes all messages after current position)
        stageSkit.script = stageSkit.script.slice(0, index + 1);
        
        // If we're continuing from an end node, clear the endScene flag and outcome
        clearEndNodeState(stageSkit, index);
        if (inputText.trim()) {
            stageSkit.script.push({ speaker: stage().getSave().player.name.toUpperCase(), message: inputText, speechUrl: '' });
        }
        
        setSkit({...stageSkit as SkitData});
        setLoading(true);
        if (index != stageSkit.script.length - 1) {
            setIndex(stageSkit.script.length - 1);
        }
        setInputText('');
        const oldIndex = stageSkit.script.length;
        stage().continueSkit().then(() => {
            const newIndex = Math.min(oldIndex, (stage().getSave().currentSkit?.script.length || 1) - 1);
            const skitData = stage().getSave().currentSkit;
            setSkit({...skitData as SkitData});
            console.log('setIndex after new skit generated.');
            setIndex(newIndex);
            setLoading(false);
            // Check if the entry at new index has endScene
            const ended = skitData?.script[newIndex]?.endScene || false;
            setSceneEnded(ended);
        });
    }

    function handleClose() {
        // Confirm any pending edits before closing
        if (isEditingMessage) {
            handleConfirmEdit();
        }
        
        stage().endSkit(setScreenType);
        // Check if aide is still being generated
        if (stage().getGenerateAidePromise()) {
            setScreenType(ScreenType.LOADING);
        } else {
            setScreenType(ScreenType.STATION);
        }
    }
}

export default SkitScreen;
