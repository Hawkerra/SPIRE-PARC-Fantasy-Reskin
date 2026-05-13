import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box } from '@mui/material';
import { TrendingUp, Handshake, TrendingDown, ContentCut } from '@mui/icons-material';
import Actor, { Stat, ACTOR_STAT_ICONS } from '../actors/Actor';
import { StationStat, STATION_STAT_ICONS } from '../Module';
import Nameplate from '../components/Nameplate';
import Faction from '../factions/Faction';
import { scoreToGrade } from '../utils';
import { SkitData } from '../Skit';
import { Stage } from '../Stage';

interface StatChange {
    statName: string;
    oldValue: number;
    newValue: number;
}

interface CharacterStatChanges {
    actor: Actor | undefined;
    statChanges: StatChange[];
}

interface FactionReputationChange {
    faction: Faction;
    oldReputation: number;
    newReputation: number;
}

interface RoleChange {
    actor: Actor;
    oldRole: string;
    newRole: string;
}

interface FactionChange {
    actor: Actor;
    oldFaction: Faction | null;
    newFaction: Faction | null;
}

interface OffStationChange {
    actor: Actor;
    isVisiting: boolean; // true if going off-station, false if returning
    faction: Faction; // The faction being visited or returned from
}

interface SkitOutcomeDisplayProps {
    skitData: SkitData;
    stage: Stage;
    layout?: any;
    messageBoxTopVh?: number;
    inputText?: string;
}

const SkitOutcomeDisplay: FC<SkitOutcomeDisplayProps> = ({ skitData, stage, layout, messageBoxTopVh = 60, inputText = '' }) => {
    // Calculate bottom position based on message box top
    const bottomVh = Math.max(100 - messageBoxTopVh + 2, 15); // At least 15vh from bottom, 2vh padding above message box
    
    // Process stat changes from skitData.endProperties
    const processStatChanges = (): CharacterStatChanges[] => {
        if (!skitData.endProperties) return [];

        const changes: CharacterStatChanges[] = [];

        Object.entries(skitData.endProperties).forEach(([actorId, statChanges]) => {
            // Handle special "STATION" id for station stat changes
            if (actorId === 'STATION') {
                const stationChanges: StatChange[] = [];

                Object.entries(statChanges).forEach(([statName, change]) => {
                    // Match stat name to StationStat (case-insensitive)
                    const stationStats = stage.getSave().stationStats || {};
                    let matchedStat: string | undefined;
                    let currentValue = 5; // default

                    // Try to find matching station stat
                    for (const [key, value] of Object.entries(stationStats)) {
                        if (key.toLowerCase() === statName.toLowerCase() ||
                            key.toLowerCase().includes(statName.toLowerCase()) ||
                            statName.toLowerCase().includes(key.toLowerCase())) {
                            matchedStat = key;
                            currentValue = value as number;
                            break;
                        }
                    }

                    if (matchedStat) {
                        const newValue = Math.max(1, Math.min(10, currentValue + change));
                        if (newValue === currentValue) return; // No change
                        stationChanges.push({
                            statName: matchedStat,
                            oldValue: currentValue,
                            newValue: newValue
                        });
                    }
                });

                if (stationChanges.length > 0) {
                    changes.push({
                        actor: undefined,
                        statChanges: stationChanges
                    });
                }
                return;
            }

            // Skip FACTION changes here, they are handled separately
            if (actorId === 'FACTION') {
                return;
            }

            const actor = stage.getSave().actors[actorId];
            if (!actor) return;

            const actorChanges: StatChange[] = [];

            Object.entries(statChanges).forEach(([statName, change]) => {
                // Find the current stat value
                const normalizedStatName = statName.toLowerCase();
                let currentValue = 0;
                let foundStat = false;

                // Try to match the stat name to the actor's stats
                Object.entries(actor.stats).forEach(([actorStat, value]) => {
                    if (actorStat.toLowerCase() === normalizedStatName || 
                        actorStat.toLowerCase().includes(normalizedStatName) ||
                        normalizedStatName.includes(actorStat.toLowerCase())) {
                        currentValue = value;
                        foundStat = true;
                    }
                });

                if (foundStat) {
                    const newValue = Math.max(1, Math.min(10, currentValue + change));
                    if (newValue === currentValue) return; // No change
                    actorChanges.push({
                        statName: statName,
                        oldValue: currentValue,
                        newValue: newValue
                    });
                }
            });

            if (actorChanges.length > 0) {
                changes.push({
                    actor: actor,
                    statChanges: actorChanges
                });
            }
        });

        return changes;
    };

    const processFactionReputationChanges = (): FactionReputationChange[] => {
        if (!skitData.endProperties || !skitData.endProperties['FACTION']) return [];

        const factionChanges: FactionReputationChange[] = [];
        const factionReputationData = skitData.endProperties['FACTION'];

        Object.entries(factionReputationData).forEach(([factionId, change]) => {
            const faction = stage.getSave().factions[factionId];
            if (!faction) return;

            const oldReputation = faction.reputation;
            const newReputation = Math.max(0, Math.min(10, oldReputation + change));

            if (newReputation !== oldReputation) {
                factionChanges.push({
                    faction: faction,
                    oldReputation: oldReputation,
                    newReputation: newReputation
                });
            }
        });

        return factionChanges;
    };

    const processRoleChanges = (): RoleChange[] => {
        if (!skitData.endRoleChanges) return [];

        const roleChanges: RoleChange[] = [];

        Object.entries(skitData.endRoleChanges).forEach(([actorId, newRole]) => {
            const actor = stage.getSave().actors[actorId];
            if (!actor) return;

            // Find the current role for this actor
            const roleModule = layout?.getModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )?.[0];
            const oldRole = roleModule?.getAttribute('role') || '';

            // Only add if there's actually a change
            if (newRole !== oldRole) {
                roleChanges.push({
                    actor: actor,
                    oldRole: oldRole || 'None',
                    newRole: newRole || 'None'
                });
            }
        });

        return roleChanges;
    };

    const processFactionChanges = (): FactionChange[] => {
        if (!skitData.endFactionChanges) return [];

        const factionChanges: FactionChange[] = [];

        Object.entries(skitData.endFactionChanges).forEach(([actorId, newFactionId]) => {
            const actor = stage.getSave().actors[actorId];
            if (!actor) return;

            const oldFactionId = actor.factionId;
            
            // Only add if there's an effective change (new faction is different from current)
            if (newFactionId !== oldFactionId) {
                const oldFaction = oldFactionId ? stage.getSave().factions[oldFactionId] : null;
                const newFaction = newFactionId ? stage.getSave().factions[newFactionId] : null;
                
                factionChanges.push({
                    actor: actor,
                    oldFaction: oldFaction,
                    newFaction: newFaction
                });
            }
        });

        return factionChanges;
    };

    const processOffStationChanges = (): OffStationChange[] => {
        if (!skitData.initialActorLocations) return [];

        const offStationChanges: OffStationChange[] = [];
        const save = stage.getSave();

        // Calculate final locations by applying all movements
        const finalLocations = {...skitData.initialActorLocations};
        skitData.script.forEach((entry) => {
            if (entry.movements) {
                Object.entries(entry.movements).forEach(([actorId, newLocation]) => {
                    finalLocations[actorId] = newLocation;
                });
            }
        });

        // Check each actor for off-station changes
        Object.entries(finalLocations).forEach(([actorId, finalLocation]) => {
            const actor = save.actors[actorId];
            if (!actor) return;
            
            // Skip actors who actually changed factions (that's a different display)
            if (skitData.endFactionChanges && skitData.endFactionChanges[actorId] !== undefined) {
                return;
            }

            const initialLocation = skitData.initialActorLocations?.[actorId] ?? '';
            if (!finalLocation || initialLocation === finalLocation) return;

            // Check if initial location is a faction
            const initialFaction = Object.values(save.factions).find(f => f.id === initialLocation);
            // Check if final location is a faction
            const finalFaction = Object.values(save.factions).find(f => f.id === finalLocation);

            // Going off-station (from non-faction to faction location)
            if (!initialFaction && finalFaction) {
                offStationChanges.push({
                    actor: actor,
                    isVisiting: true,
                    faction: finalFaction
                });
            }
            // Returning to station (from faction to non-faction location)
            else if (initialFaction && !finalFaction) {
                offStationChanges.push({
                    actor: actor,
                    isVisiting: false,
                    faction: initialFaction
                });
            }
        });

        return offStationChanges;
    };

    const characterChanges = processStatChanges();
    const factionReputationChanges = processFactionReputationChanges();
    const roleChanges = processRoleChanges();
    const factionChanges = processFactionChanges();
    const offStationChanges = processOffStationChanges();
    const newModule = skitData.endNewModule;
    const newAppearances = skitData.endNewAppearances;

    // Don't render if there's nothing to display
    if (characterChanges.length === 0 && factionReputationChanges.length === 0 && roleChanges.length === 0 && factionChanges.length === 0 && offStationChanges.length === 0 && !newModule && (!newAppearances || newAppearances.length === 0)) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{
                position: 'absolute',
                top: '3%',
                right: '3%',
                bottom: stage.betaMode ? `3%` : `${bottomVh}vh`,
                zIndex: 3,
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'flex-start',
                gap: '20px',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '0 20px'
            }}
        >
            {/* Column container */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '30vmin',
                    minWidth: '300px',
                    maxHeight: '100%',
                    overflowY: 'auto'
                }}
            >
            {/* Header */}
            <div>
                <Paper
                    elevation={8}
                    sx={{
                        background: 'linear-gradient(135deg, rgba(0,255,136,0.25) 0%, rgba(0,180,100,0.35) 50%, rgba(0,120,80,0.25) 100%)',
                        border: '2px solid rgba(0,255,136,0.4)',
                        borderRadius: 2,
                        p: 1.5,
                        backdropFilter: 'blur(12px)',
                        textAlign: 'center'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <TrendingUp sx={{ color: '#00ff88', fontSize: '1.5rem' }} />
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                            }}
                        >
                            Outcome
                        </Typography>
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            mt: 0.5
                        }}
                    >
                        {inputText.length > 0 && (
                            <span 
                                style={{ 
                                    color: '#ffaa00',
                                    fontSize: '1.1em',
                                    fontWeight: 900
                                }}
                                title="Submitting input will discard these outcomes"
                            >
                                ⚠
                            </span>
                        )}
                        {inputText.length > 0 ? 'Continuing will forfeit this outcome.' : 'End to confirm; continue to ignore.'}
                    </Typography>
                </Paper>
            </div>

            {/* Character stat changes */}
            {characterChanges.map((charChange, charIndex) => (
                <div key={charChange.actor ? `stat_${charChange.actor.id}` : `stat_PARC`}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 + charIndex * 0.2 }}
                    >
                        <Paper
                        elevation={6}
                        sx={{
                            background: 'rgba(10,20,30,0.95)',
                            border: '2px solid rgba(0,255,136,0.15)',
                            borderRadius: 3,
                            p: 2,
                            backdropFilter: 'blur(8px)',
                            textAlign: 'center'
                        }}
                    >
                        {/* Large Character Portrait */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.6 + charIndex * 0.2 }}
                            style={{ marginBottom: '12px' }}
                        >
                            <Box
                                sx={{
                                    width: '100%',
                                    height: '150px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '2px solid rgba(0,255,136,0.4)',
                                    backgroundImage: `url(${charChange.actor === undefined ? "https://media.charhub.io/41b7b65d-839b-4d31-8c11-64ee50e817df/0fc1e223-ad07-41c4-bdae-c9545d5c5e34.png" : 
                                        charChange.actor.getEmotionImage(charChange.actor.getDefaultEmotion())})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: '50% 15%',
                                    backgroundRepeat: 'no-repeat',
                                    filter: 'brightness(1.1)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                    '&:hover': {
                                        transform: 'scale(1.02)',
                                        transition: 'transform 0.2s ease-in-out'
                                    }
                                }}
                            />
                        </motion.div>

                        {/* Character Nameplate */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.7 + charIndex * 0.2 }}
                            style={{ marginBottom: '12px' }}
                        >
                            {!charChange.actor ? (
                                <Nameplate 
                                    name="PARC"
                                    size="large"
                                    layout="inline"
                                />
                            ) : (
                                <Nameplate 
                                    actor={charChange.actor} 
                                    size="large"
                                    role={layout ? (() => {
                                        const roleModules = layout.getModulesWhere((m: any) => 
                                            m && m.type !== 'quarters' && m.ownerId === charChange.actor?.id
                                        );
                                        return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
                                    })() : undefined}
                                    layout="inline"
                                />
                            )}
                        </motion.div>

                        {/* Stat changes */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {charChange.statChanges.map((statChange, statIndex) => {
                                const isIncrease = statChange.newValue > statChange.oldValue;
                                const isDecrease = statChange.newValue < statChange.oldValue;
                                
                                return (
                                <motion.div
                                    key={`${charChange.actor ? charChange.actor.id : 'PARC'}-${statChange.statName}`}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: 0.8 + charIndex * 0.2 + statIndex * 0.1 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 4px',
                                        background: isDecrease 
                                            ? 'rgba(255,80,80,0.08)' 
                                            : isIncrease 
                                                ? 'rgba(0,255,136,0.08)' 
                                                : 'rgba(255,255,255,0.05)',
                                        borderRadius: '8px',
                                        border: isDecrease 
                                            ? '1px solid rgba(255,80,80,0.3)' 
                                            : isIncrease 
                                                ? '1px solid rgba(0,255,136,0.3)' 
                                                : '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {/* Stat name with icon */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {(() => {
                                            // Determine if this is an actor stat or station stat
                                            const isActorStat = charChange.actor !== undefined;
                                            const statIcon = isActorStat 
                                                ? ACTOR_STAT_ICONS[statChange.statName as Stat]
                                                : STATION_STAT_ICONS[statChange.statName as StationStat];
                                            const StatIconComponent = statIcon;
                                            
                                            return StatIconComponent ? (
                                                <StatIconComponent 
                                                    sx={{ 
                                                        fontSize: '1.2rem', 
                                                        color: isIncrease ? '#00ff88' : isDecrease ? '#ff6b6b' : '#ffffff',
                                                        opacity: 0.9 
                                                    }} 
                                                />
                                            ) : null;
                                        })()}
                                        <Typography
                                            variant="body1"
                                            className="stat-label"
                                            sx={{
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            {statChange.statName}
                                        </Typography>
                                    </Box>

                                    {/* Grade transition */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        {/* Old grade */}
                                        <span
                                            className="stat-grade"
                                            data-grade={scoreToGrade(statChange.oldValue)}
                                            style={{
                                                fontSize: '2rem',
                                                opacity: 0.6,
                                                filter: 'grayscale(0.5)'
                                            }}
                                        >
                                            {scoreToGrade(statChange.oldValue)}
                                        </span>

                                        {/* Arrow */}
                                        <Typography
                                            sx={{
                                                color: isDecrease 
                                                    ? '#ff5050' 
                                                    : isIncrease 
                                                        ? '#00ff88' 
                                                        : '#ffffff',
                                                fontWeight: 900,
                                                fontSize: '1.4rem',
                                                mx: 0.5,
                                                textShadow: isDecrease 
                                                    ? '0 2px 4px rgba(255,0,0,0.6)' 
                                                    : isIncrease 
                                                        ? '0 2px 4px rgba(0,255,0,0.6)' 
                                                        : '0 2px 4px rgba(0,0,0,0.6)'
                                            }}
                                        >
                                            {isDecrease ? '↓' : isIncrease ? '↑' : '→'}
                                        </Typography>

                                        {/* New grade */}
                                        <motion.span
                                            className="stat-grade"
                                            data-grade={scoreToGrade(statChange.newValue)}
                                            style={{
                                                fontSize: '2rem'
                                            }}
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ duration: 0.5, delay: 0.9 + charIndex * 0.2 + statIndex * 0.1 }}
                                        >
                                            {scoreToGrade(statChange.newValue)}
                                        </motion.span>
                                    </Box>
                                </motion.div>
                                );
                            })}
                        </Box>
                    </Paper>
                </motion.div>
                </div>
            ))}

            {/* Faction Reputation Changes */}
            {factionReputationChanges.map((repChange, repIndex) => (
                <div key={`faction_rep_${repChange.faction.id}`}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                >
                    <Paper
                        elevation={6}
                        sx={{
                            background: 'rgba(10,20,30,0.95)',
                            border: repChange.newReputation <= 0
                                ? '2px solid rgba(150,150,150,0.3)'
                                : repChange.newReputation > repChange.oldReputation
                                ? '2px solid rgba(0,255,136,0.15)'
                                : '2px solid rgba(255,80,80,0.15)',
                            borderRadius: 3,
                            p: 2,
                            backdropFilter: 'blur(8px)',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Background Image */}
                        {repChange.faction.backgroundImageUrl && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundImage: `url(${repChange.faction.backgroundImageUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    opacity: 0.1,
                                    zIndex: 0
                                }}
                            />
                        )}

                        {/* Dark overlay for readability */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 10, 20, 0.7)',
                                zIndex: 0
                            }}
                        />

                        {/* Content */}
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                            {/* Header with icon */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.6 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                                    {repChange.newReputation <= 0 ? (
                                        <ContentCut sx={{ color: '#888', fontSize: '2rem', transform: 'rotate(15deg)' }} />
                                    ) : repChange.newReputation > repChange.oldReputation ? (
                                        <TrendingUp sx={{ color: '#00ff88', fontSize: '2rem' }} />
                                    ) : (
                                        <TrendingDown sx={{ color: '#ff5050', fontSize: '2rem' }} />
                                    )}
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 800,
                                            color: repChange.newReputation <= 0 ? '#888' : repChange.newReputation > repChange.oldReputation ? '#00ff88' : '#ff5050',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                        }}
                                    >
                                        {repChange.newReputation <= 0 ? 'Ties Severed' : `Reputation ${repChange.newReputation > repChange.oldReputation ? 'Improved' : 'Declined'}`}
                                    </Typography>
                                </Box>
                            </motion.div>

                            {/* Faction Nameplate */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.7 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <Nameplate
                                    name={repChange.faction.name}
                                    size="large"
                                    layout="inline"
                                    style={{
                                        background: repChange.faction.themeColor || '#4a5568',
                                        border: repChange.faction.themeColor ? `2px solid ${repChange.faction.themeColor}CC` : '2px solid #718096',
                                        fontFamily: repChange.faction.themeFont || 'Arial, sans-serif',
                                    }}
                                />
                            </motion.div>

                            {/* Reputation change display or cut ties message */}
                            {repChange.newReputation <= 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, delay: 0.8 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                                    style={{
                                        padding: '16px',
                                        background: 'rgba(80,80,80,0.15)',
                                        borderRadius: '12px',
                                        border: '2px solid rgba(150,150,150,0.3)'
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '1.1rem',
                                            fontWeight: 700,
                                            color: '#aaa',
                                            textAlign: 'center',
                                            lineHeight: 1.6,
                                            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                        }}
                                    >
                                        {repChange.faction.name} has severed all ties with the PARC.
                                    </Typography>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: 0.8 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '12px',
                                        background: repChange.newReputation > repChange.oldReputation
                                            ? 'rgba(0,255,136,0.08)'
                                            : 'rgba(255,80,80,0.08)',
                                        borderRadius: '12px',
                                        border: repChange.newReputation > repChange.oldReputation
                                            ? '1px solid rgba(0,255,136,0.3)'
                                            : '1px solid rgba(255,80,80,0.3)',
                                        gap: '16px'
                                    }}
                                >
                                {/* Old reputation */}
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography
                                        sx={{
                                            fontSize: '2.5rem',
                                            fontWeight: 900,
                                            color: '#666',
                                            opacity: 0.6,
                                            textShadow: '0 2px 4px rgba(0,0,0,0.6)'
                                        }}
                                    >
                                        {scoreToGrade(repChange.oldReputation)}
                                    </Typography>
                                </Box>

                                {/* Arrow */}
                                <Typography
                                    sx={{
                                        color: repChange.newReputation > repChange.oldReputation ? '#00ff88' : '#ff5050',
                                        fontWeight: 900,
                                        fontSize: '2rem',
                                        textShadow: repChange.newReputation > repChange.oldReputation
                                            ? '0 2px 4px rgba(0,255,0,0.6)'
                                            : '0 2px 4px rgba(255,0,0,0.6)'
                                    }}
                                >
                                    {repChange.newReputation > repChange.oldReputation ? '↑' : '↓'}
                                </Typography>

                                {/* New reputation */}
                                <Box sx={{ textAlign: 'center' }}>
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.9 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: '2.5rem',
                                                fontWeight: 900,
                                                color: repChange.newReputation > repChange.oldReputation ? '#00ff88' : '#ff5050',
                                                textShadow: repChange.newReputation > repChange.oldReputation
                                                    ? '0 2px 4px rgba(0,255,0,0.6)'
                                                    : '0 2px 4px rgba(255,0,0,0.6)'
                                            }}
                                        >
                                            {scoreToGrade(repChange.newReputation)}
                                        </Typography>
                                    </motion.div>
                                </Box>
                            </motion.div>
                            )}

                            {/* Reputation scale indicator - only show if not cut ties */}
                            {repChange.newReputation > 0 && (
                            <Box sx={{ mt: 1.5, px: 2 }}>
                                <Box
                                    sx={{
                                        height: '8px',
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <motion.div
                                        initial={{ width: `${(repChange.oldReputation / 10) * 100}%` }}
                                        animate={{ width: `${(repChange.newReputation / 10) * 100}%` }}
                                        transition={{ duration: 1, delay: 1 + characterChanges.length * 0.2 + repIndex * 0.2 }}
                                        style={{
                                            height: '100%',
                                            background: repChange.newReputation > repChange.oldReputation
                                                ? 'linear-gradient(90deg, #00ff88, #00cc66)'
                                                : 'linear-gradient(90deg, #ff5050, #cc3030)',
                                            borderRadius: '4px'
                                        }}
                                    />
                                </Box>
                                <Typography
                                    sx={{
                                        fontSize: '0.65rem',
                                        color: '#666',
                                        textAlign: 'center',
                                        mt: 0.5
                                    }}
                                >
                                    {repChange.newReputation}/10
                                </Typography>
                            </Box>
                            )}
                        </Box>
                    </Paper>
                </motion.div>
                </div>
            ))}

            {/* Role Changes */}
            {roleChanges.map((roleChange, roleIndex) => (
                <div key={`role_${roleChange.actor.id}`}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleIndex * 0.2 }}
                >
                    <Paper
                        elevation={6}
                        sx={{
                            background: 'rgba(10,20,30,0.95)',
                            border: '2px solid rgba(100,180,255,0.3)',
                            borderRadius: 3,
                            p: 2,
                            backdropFilter: 'blur(8px)',
                            textAlign: 'center'
                        }}
                    >
                        {/* Large Character Portrait */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.6 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleIndex * 0.2 }}
                            style={{ marginBottom: '12px' }}
                        >
                            <Box
                                sx={{
                                    width: '100%',
                                    height: '150px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '2px solid rgba(100,180,255,0.4)',
                                    backgroundImage: `url(${roleChange.actor.getEmotionImage(roleChange.actor.getDefaultEmotion())})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: '50% 15%',
                                    backgroundRepeat: 'no-repeat',
                                    filter: 'brightness(1.1)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                    '&:hover': {
                                        transform: 'scale(1.02)',
                                        transition: 'transform 0.2s ease-in-out'
                                    }
                                }}
                            />
                        </motion.div>

                        {/* Character Nameplate */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.7 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleIndex * 0.2 }}
                            style={{ marginBottom: '12px' }}
                        >
                            <Nameplate 
                                actor={roleChange.actor} 
                                size="large"
                                layout="inline"
                            />
                        </motion.div>

                        {/* Role Change Header */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.8 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleIndex * 0.2 }}
                            style={{ marginBottom: '16px' }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 800,
                                    color: '#64b4ff',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                    mb: 1
                                }}
                            >
                                Role Changed
                            </Typography>
                        </motion.div>

                        {/* Role transition display */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.9 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleIndex * 0.2 }}
                            style={{
                                padding: '16px',
                                background: 'rgba(100,180,255,0.1)',
                                borderRadius: '12px',
                                border: '2px solid rgba(100,180,255,0.2)'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                {/* Old Role */}
                                <Box sx={{ textAlign: 'center', flex: 1 }}>
                                    <Typography
                                        sx={{
                                            fontSize: '0.8rem',
                                            color: '#888',
                                            textTransform: 'uppercase',
                                            mb: 0.5
                                        }}
                                    >
                                        Previous
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: '1.2rem',
                                            fontWeight: 700,
                                            color: '#aaa',
                                            textDecoration: 'line-through'
                                        }}
                                    >
                                        {roleChange.oldRole}
                                    </Typography>
                                </Box>

                                {/* Arrow */}
                                <Typography
                                    sx={{
                                        fontSize: '2rem',
                                        color: '#64b4ff',
                                        fontWeight: 900
                                    }}
                                >
                                    →
                                </Typography>

                                {/* New Role */}
                                <Box sx={{ textAlign: 'center', flex: 1 }}>
                                    <Typography
                                        sx={{
                                            fontSize: '0.8rem',
                                            color: '#64b4ff',
                                            textTransform: 'uppercase',
                                            mb: 0.5
                                        }}
                                    >
                                        New
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: '1.4rem',
                                            fontWeight: 900,
                                            color: '#64b4ff',
                                            textShadow: '0 2px 4px rgba(100,180,255,0.6)'
                                        }}
                                    >
                                        {roleChange.newRole}
                                    </Typography>
                                </Box>
                            </Box>
                        </motion.div>
                    </Paper>
                </motion.div>
                </div>
            ))}

            {/* Faction Changes */}
            {factionChanges.map((factionChange, factionIndex) => {
                const PARC_BACKGROUND = "https://media.charhub.io/41b7b65d-839b-4d31-8c11-64ee50e817df/0fc1e223-ad07-41c4-bdae-c9545d5c5e34.png";
                const newFactionBackground = factionChange.newFaction?.backgroundImageUrl || PARC_BACKGROUND;
                const oldFactionName = factionChange.oldFaction?.name || 'PARC';
                const newFactionName = factionChange.newFaction?.name || 'PARC';
                
                return (
                <div key={`faction_${factionChange.actor.id}`}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionIndex * 0.2 }}
                >
                    <Paper
                        elevation={6}
                        sx={{
                            background: 'rgba(10,20,30,0.95)',
                            border: '2px solid rgba(255,200,0,0.3)',
                            borderRadius: 3,
                            p: 2,
                            backdropFilter: 'blur(8px)',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Background Image - new faction */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: `url(${newFactionBackground})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                opacity: 0.15,
                                zIndex: 0
                            }}
                        />

                        {/* Dark overlay for readability */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 10, 20, 0.7)',
                                zIndex: 0
                            }}
                        />

                        {/* Content */}
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                            {/* Character Portrait over faction background */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.6 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionIndex * 0.2 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <Box
                                    sx={{
                                        width: '100%',
                                        height: '150px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: '2px solid rgba(255,200,0,0.4)',
                                        position: 'relative',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                    }}
                                >
                                    {/* Faction background */}
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundImage: `url(${newFactionBackground})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            filter: 'brightness(0.6)',
                                        }}
                                    />
                                    {/* Character portrait overlay */}
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundImage: `url(${factionChange.actor.getEmotionImage(factionChange.actor.getDefaultEmotion())})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: '50% 15%',
                                            backgroundRepeat: 'no-repeat',
                                            filter: 'brightness(1.1)',
                                            mixBlendMode: 'normal',
                                            '&:hover': {
                                                transform: 'scale(1.02)',
                                                transition: 'transform 0.2s ease-in-out'
                                            }
                                        }}
                                    />
                                </Box>
                            </motion.div>

                            {/* Character Nameplate */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.7 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionIndex * 0.2 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <Nameplate 
                                    actor={factionChange.actor} 
                                    size="large"
                                    layout="inline"
                                />
                            </motion.div>

                            {/* Faction transition display */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.8 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionIndex * 0.2 }}
                                style={{
                                    padding: '16px',
                                    background: 'rgba(255,200,0,0.1)',
                                    borderRadius: '12px',
                                    border: '2px solid rgba(255,200,0,0.2)'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                    {/* Old Faction */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography
                                            sx={{
                                                fontSize: '1.2rem',
                                                fontWeight: 700,
                                                color: '#aaa',
                                                textDecoration: 'line-through'
                                            }}
                                        >
                                            {oldFactionName}
                                        </Typography>
                                    </Box>

                                    {/* Arrow */}
                                    <Typography
                                        sx={{
                                            fontSize: '2rem',
                                            color: '#ffc800',
                                            fontWeight: 900
                                        }}
                                    >
                                        →
                                    </Typography>

                                    {/* New Faction */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography
                                            sx={{
                                                fontSize: '1.4rem',
                                                fontWeight: 900,
                                                color: '#ffc800',
                                                textShadow: '0 2px 4px rgba(255,200,0,0.6)'
                                            }}
                                        >
                                            {newFactionName}
                                        </Typography>
                                    </Box>
                                </Box>
                            </motion.div>
                        </Box>
                    </Paper>
                </motion.div>
                </div>
                );
            })}

            {/* Off-Station Changes (Visiting/Returning) */}
            {offStationChanges.map((offStationChange, offStationIndex) => {
                const isVisiting = offStationChange.isVisiting;
                
                return (
                <div key={`offstation_${offStationChange.actor.id}`}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationIndex * 0.2 }}
                >
                    <Paper
                        elevation={6}
                        sx={{
                            background: 'rgba(10,20,30,0.95)',
                            border: isVisiting ? '2px solid rgba(147,51,234,0.3)' : '2px solid rgba(34,197,94,0.3)',
                            borderRadius: 3,
                            p: 2,
                            backdropFilter: 'blur(8px)',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Background Image - faction background */}
                        {offStationChange.faction.backgroundImageUrl && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: `url(${offStationChange.faction.backgroundImageUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                opacity: 0.15,
                                zIndex: 0
                            }}
                        />
                        )}

                        {/* Dark overlay for readability */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 10, 20, 0.7)',
                                zIndex: 0
                            }}
                        />

                        {/* Content */}
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                            {/* Character Portrait */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.6 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationIndex * 0.2 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <Box
                                    sx={{
                                        width: '100%',
                                        height: '150px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: isVisiting ? '2px solid rgba(147,51,234,0.4)' : '2px solid rgba(34,197,94,0.4)',
                                        backgroundImage: `url(${offStationChange.actor.getEmotionImage(offStationChange.actor.getDefaultEmotion())})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: '50% 15%',
                                        backgroundRepeat: 'no-repeat',
                                        filter: 'brightness(1.1)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                        '&:hover': {
                                            transform: 'scale(1.02)',
                                            transition: 'transform 0.2s ease-in-out'
                                        }
                                    }}
                                />
                            </motion.div>

                            {/* Character Nameplate */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.7 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationIndex * 0.2 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <Nameplate 
                                    actor={offStationChange.actor} 
                                    size="large"
                                    layout="inline"
                                />
                            </motion.div>

                            {/* Off-Station Message */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.8 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationIndex * 0.2 }}
                                style={{
                                    padding: '16px',
                                    background: isVisiting ? 'rgba(147,51,234,0.1)' : 'rgba(34,197,94,0.1)',
                                    borderRadius: '12px',
                                    border: isVisiting ? '2px solid rgba(147,51,234,0.2)' : '2px solid rgba(34,197,94,0.2)'
                                }}
                            >
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 800,
                                        color: isVisiting ? '#9333ea' : '#22c55e',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                        mb: 1.5
                                    }}
                                >
                                    {isVisiting ? 'Visiting Off-Station' : 'Returning to Station'}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: '1.2rem',
                                        fontWeight: 600,
                                        color: '#fff',
                                        lineHeight: 1.5,
                                        textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                    }}
                                >
                                    {isVisiting 
                                        ? `${offStationChange.actor.name} is visiting ${offStationChange.faction.name}`
                                        : `${offStationChange.actor.name} has returned from ${offStationChange.faction.name}`
                                    }
                                </Typography>
                            </motion.div>
                        </Box>
                    </Paper>
                </motion.div>
                </div>
                );
            })}

            {/* New Module Research */}
            {newModule && (
                <div key="new_module">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationChanges.length * 0.2 }}
                    >
                        <Paper
                            elevation={6}
                            sx={{
                                background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.25) 50%, rgba(139,92,246,0.15) 100%)',
                                border: '2px solid rgba(99,102,241,0.3)',
                                borderRadius: 3,
                                p: 2,
                                backdropFilter: 'blur(8px)',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Dark overlay for readability */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0, 10, 20, 0.7)',
                                    zIndex: 0
                                }}
                            />

                            {/* Content */}
                            <Box sx={{ position: 'relative', zIndex: 1 }}>
                                {/* Header */}
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationChanges.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 800,
                                            color: '#6366f1',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                        }}
                                    >
                                        Researching New Module
                                    </Typography>
                                </motion.div>

                                {/* Module Name */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.7 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationChanges.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '1.4rem',
                                            fontWeight: 700,
                                            color: '#fff',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                        }}
                                    >
                                        {newModule.moduleName}
                                    </Typography>
                                </motion.div>

                                {/* Role Badge */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, delay: 0.8 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationChanges.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Box
                                        sx={{
                                            display: 'inline-block',
                                            padding: '8px 16px',
                                            background: 'rgba(99,102,241,0.2)',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(99,102,241,0.4)'
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: '0.95rem',
                                                fontWeight: 600,
                                                color: '#a5b4fc',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}
                                        >
                                            Role: {newModule.roleName}
                                        </Typography>
                                    </Box>
                                </motion.div>

                                {/* Description */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: 0.9 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationChanges.length * 0.2 }}
                                >
                                    <Box
                                        sx={{
                                            padding: '12px',
                                            background: 'rgba(99,102,241,0.08)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(99,102,241,0.2)'
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: '0.95rem',
                                                fontWeight: 500,
                                                color: '#cbd5e1',
                                                lineHeight: 1.6,
                                                textAlign: 'left',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.6)'
                                            }}
                                        >
                                            {newModule.description}
                                        </Typography>
                                    </Box>
                                </motion.div>
                            </Box>
                        </Paper>
                    </motion.div>
                </div>
            )}

            {/* New Appearance Research */}
            {(newAppearances || []).map((newAppearance, appearanceIndex) => (
                    <div key={`new_appearance_${newAppearance.id || appearanceIndex}`}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 + characterChanges.length * 0.2 + factionReputationChanges.length * 0.2 + roleChanges.length * 0.2 + factionChanges.length * 0.2 + offStationChanges.length * 0.2 + (newModule ? 0.2 : 0) + appearanceIndex * 0.15 }}
                    >
                        <Paper
                            elevation={6}
                            sx={{
                                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(6,182,212,0.22) 50%, rgba(14,165,233,0.12) 100%)',
                                border: '2px solid rgba(16,185,129,0.35)',
                                borderRadius: 3,
                                p: 2,
                                backdropFilter: 'blur(8px)',
                                textAlign: 'center'
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 800,
                                    color: '#10b981',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                    mb: 1
                                }}
                            >
                                New Appearance Added
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    color: '#fff',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                    mb: 1
                                }}
                            >
                                {stage.getSave().actors[newAppearance.actorId]?.name || 'Unknown'}: {newAppearance.appearanceName}
                            </Typography>
                            <Box
                                sx={{
                                    padding: '12px',
                                    background: 'rgba(16,185,129,0.1)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(16,185,129,0.25)'
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '0.95rem',
                                        fontWeight: 500,
                                        color: '#d1fae5',
                                        lineHeight: 1.6,
                                        textAlign: 'left',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.6)'
                                    }}
                                >
                                    {newAppearance.description}
                                </Typography>
                            </Box>
                        </Paper>
                    </motion.div>
                </div>
            ))}
            </Box>
        </motion.div>
    );
};

export default SkitOutcomeDisplay;
