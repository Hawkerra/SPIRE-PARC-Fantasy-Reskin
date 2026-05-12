/*
 * This screen displays Visual Novel skit scenes, displaying dialogue and characters as they interact with the player and each other.
 */
import React, { FC, useCallback, useEffect } from 'react';
import { ScreenType } from './BaseScreen';
import Actor, { getRole, isHologram } from '../actors/Actor';
import { Stage } from '../Stage';
import { generateSkitScript, SkitData } from '../Skit';
import { Emotion } from '../actors/Emotion';
import SkitOutcomeDisplay from './SkitOutcomeDisplay';
import Nameplate from '../components/Nameplate';
import { BlurredBackground } from '../components/BlurredBackground';
import { useTooltip } from '../contexts/TooltipContext';
import ActorCard, { ActorCardSection } from '../components/ActorCard';
import { ContentManagementScreen } from './ContentManagementScreen';

import {
    Send,
    LastPage,
    PlayArrow,
    Menu as MenuIcon,
    EditNote
} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { NovelVisualizer } from '@lord-raven/novel-visualizer';

interface SkitScreenBetaProps {
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

export const SkitScreenBeta: FC<SkitScreenBetaProps> = ({ stage, setScreenType, isVerticalLayout }) => {
    const { setTooltip, clearTooltip } = useTooltip();
    const [skit, setSkit] = React.useState<SkitData>(stage().getSave().currentSkit as SkitData);
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [showContentManagement, setShowContentManagement] = React.useState(false);

    const currentSceneModuleId = getSceneModuleIdAtIndex(skit, skit.currentIndex || 0);
    const module = stage().getSave().layout.getModuleById(currentSceneModuleId || '');
    const decorImageUrl = module ? stage().getSave().actors[module.ownerId || '']?.decorImageUrls[module.type] || module.getAttribute('defaultImageUrl') : '';

    const actors = {...stage().getSave().actors, 'player': {
        id: 'player',
        name: stage().getSave().player.name,
        decorImageUrls: {},
        outfitId: '',
        getEmotionImage: () => '', // Player doesn't have an image, but this prevents errors when trying to access it.
        themeColor: '#718096',
        themeFontFamily: `'Geologica', sans-serif`, // Player needs some nice default font.
    }};

	const handleSkitSubmit = useCallback(async (input: string, skitArg: any, index: number) => {
		index = Math.max(0, index);
		if (input.trim() === '' && skitArg.script.length > 0 && skitArg.script[index].endScene) {
            console.log('Ending skit and returning to map screen');
			stage().endSkit(setScreenType);
			return null;
		} else {
			const nextEntries = await generateSkitScript(skitArg as SkitData, stage());
			(skitArg as SkitData).script.push(...nextEntries.entries);
			const currentTimelineEvent = stage().getSave().timeline?.find(e => e.skit?.id === skitArg.id);
			if (currentTimelineEvent) {
				currentTimelineEvent.skit = skitArg as SkitData;
				stage().saveGame();
			}
			return skitArg;
		}
	}, [stage]);

    useEffect(() => {
        if (skit.script.length == 0) {
            setIsLoading(true);
            stage().continueSkit().then(() => {
                setSkit({...stage().getSave().currentSkit as SkitData});
                setIsLoading(false);
            });
        }
    }, [skit]);

    // Handle Escape key to open menu
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !showContentManagement) {
                setScreenType(ScreenType.MENU);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setScreenType, showContentManagement]);

    return (
		<BlurredBackground
			imageUrl={decorImageUrl}
			// overlay="linear-gradient(130deg, rgba(5, 24, 34, 0.78) 0%, rgba(18, 47, 32, 0.72) 50%, rgba(37, 24, 57, 0.78) 100%)"
		>
            {/* Top right control buttons */}
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                display: 'flex',
                gap: '0.5rem',
                zIndex: 10
            }}>
                <IconButton 
                    onClick={() => setShowContentManagement(true)}
                    title="Content Management"
                    sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                            color: 'rgba(255, 255, 255, 1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    <EditNote />
                </IconButton>
                <IconButton 
                    onClick={() => setScreenType(ScreenType.MENU)}
                    title="Menu"
                    sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                            color: 'rgba(255, 255, 255, 1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    <MenuIcon />
                </IconButton>
            </div>

            <NovelVisualizer
                skit={skit}
                loading={isLoading}
                renderNameplate={(actor: any) => {
                    if (!actor || !actor.name) return null;
                    return <Nameplate 
                                actor={actor} 
                                size={isVerticalLayout ? "medium" : "large"}
                                style={{ // center nameplate horizontally in parent container:
                                    position: 'absolute',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 5
                                }}
                                role={(() => {
                                    const roleModules = stage().getSave().layout.getModulesWhere((m: any) => 
                                        m && m.type !== 'quarters' && m.ownerId === actor.id
                                    );
                                    return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
                                })()}
                                layout="inline"
                    />;
                }}
                setTooltip={setTooltip}
                isVerticalLayout={isVerticalLayout}
                actors={actors}
                playerActorId={'player'}
                getPresentActors={(_script, _index) =>
                    getActorsAtIndex(_script, _index, stage().getSave().actors) || []
                }
                getActorImageUrl={(actor, _script, index) => {
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
                    const outfitId = getActorOutfitsAtIndex(_script, index, stage().getSave().actors)[actor.id] || actor.outfitId;
                    return actor.getEmotionImage(emotion, stage(), outfitId);
                }}
                getActorFilter={(actor, _script, index) => {
                    // Get current location ID of this actor as of this index in the script (the actor may not be in the scene; if their location is not a module, then they should be a hologram):
                    const actorLocationId = (() => {
                        const locations = _script.initialActorLocations || {};
                        let currentLocationId = locations[actor.id] || '';
                        for (let i = 0; i <= index && i < _script.script.length; i++) {
                            const entry = _script.script[i];
                            if (entry.movements && entry.movements[actor.id]) {
                                currentLocationId = entry.movements[actor.id];
                            }
                        }
                        return currentLocationId;
                    })();

                    return {
                        filter: isHologram(actor, stage().getSave(), actorLocationId) ? 'hologram' : undefined,
                        filterColor: isHologram(actor, stage().getSave(), actorLocationId) ? actor.themeColor : undefined
                    };
                }}
                onSubmitInput={handleSkitSubmit}
                getSubmitButtonConfig={(_script, index, inputText) => {
                    const endScene = index >= 0 ? (_script.script[index]?.endScene || false) : false;
                    return {
                        label: inputText.trim().length > 0 ? 'Send' : (endScene ? 'End' : 'Continue'),
                        enabled: true,
                        colorScheme: inputText.trim().length > 0 ? 'primary' : (endScene ? 'error' : 'primary'),
                        icon: inputText.trim().length > 0 ? <Send /> : (endScene ? <LastPage /> : <PlayArrow />),
                    };
                }}
                enableAudio={!stage().getSave().disableTextToSpeech}
                enablePopInSpeakers={true}
                enableTalkingAnimation={true}
                responsiveOverlay={(skit, actor) => {
                    if (skit && skit.script && skit.script.length > 0) {
                        if (skit.script[Math.min(skit.currentIndex || 0, skit.script.length - 1)]?.endScene || false) {
                            return (
                                <SkitOutcomeDisplay skitData={skit} stage={stage()} layout={stage().getSave().layout} />
                            );
                        }
                    }
                    if (!actor || actor.id == 'player') return null;
                    // place box on right; width is 30vw in horizontal layout, 40vw in vertical. The below is itself wrapped with an absolute positioned container, so this should be relative.
                    return (
                        <div style={{
                            position: 'relative',
                            maxWidth: isVerticalLayout ? '30vw' : '15vw',
                            right: 0,
                            top: 0
                        }}>
                            <ActorCard
                                actor={actor}
                                visitingFaction={undefined /* Don't display visiting status in skits. */}
                                role={getRole(actor, stage().getSave())}
                                collapsedSections={[ActorCardSection.STATS]}
                            />
                        </div>
                    );
                }}
            />
            
            {/* Content Management Modal */}
            {showContentManagement && (
                <ContentManagementScreen
                    stage={stage}
                    onClose={() => setShowContentManagement(false)}
                />
            )}
        </BlurredBackground>
    );

}

export default SkitScreenBeta;
