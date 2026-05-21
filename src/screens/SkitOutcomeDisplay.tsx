import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box } from '@mui/material';
import { TrendingUp, Handshake, TrendingDown, ContentCut, Work, DomainAdd, Output, Input } from '@mui/icons-material';
import Actor, { Stat, ACTOR_STAT_ICONS } from '../actors/Actor';
import Nameplate from '../components/Nameplate';
import { scoreToGrade } from '../utils';
import { StationStat, STATION_STAT_ICONS } from '../Module';
import { Outcome } from '../Skit';
import { Stage } from '../Stage';


interface SkitOutcomeDisplayProps {
    outcomes: Outcome[];
    stage: Stage;
    layout?: any;
}

const SkitOutcomeDisplay: FC<SkitOutcomeDisplayProps> = ({ outcomes, stage, layout }) => {
    // Calculate bottom position based on message box top

    const currentOutcomes: Outcome[] = outcomes || [];
    const save = stage.getSave();

    // --- Stat grouping ---
    interface StatEntry { stat: Stat | StationStat; oldValue: number; newValue: number; }
    interface ActorStatGroup { actorId: string; actor: Actor | undefined; entries: StatEntry[]; }

    const actorStatGroups: ActorStatGroup[] = (() => {
        const map = new Map<string, ActorStatGroup>();
        currentOutcomes.filter(o => o.type === 'actorStat' && o.actorId && o.stat != null).forEach(o => {
            const actorId = o.actorId!;
            if (!map.has(actorId)) {
                const actor: Actor | undefined = save.actors[actorId];
                map.set(actorId, { actorId, actor, entries: [] });
            }
            const actor = map.get(actorId)!.actor;
            const currentValue: number = actor?.stats?.[o.stat as Stat] ?? 5;
            const newValue = Math.max(1, Math.min(10, currentValue + (o.amount ?? 0)));
            if (newValue !== currentValue) {
                map.get(actorId)!.entries.push({ stat: o.stat!, oldValue: currentValue, newValue });
            }
        });
        return Array.from(map.values()).filter(g => g.entries.length > 0);
    })();

    const stationStatEntries: StatEntry[] = (() => {
        return currentOutcomes
            .filter(o => o.type === 'stationStat' && o.stat != null)
            .map(o => {
                const currentValue: number = save.stationStats?.[o.stat as StationStat] ?? 5;
                const newValue = Math.max(1, Math.min(10, currentValue + (o.amount ?? 0)));
                return { stat: o.stat!, oldValue: currentValue, newValue };
            })
            .filter(e => e.newValue !== e.oldValue);
    })();

    const otherOutcomes = currentOutcomes.filter(o => o.type !== 'actorStat' && o.type !== 'stationStat');

    const resolveActorName = (actorId?: string): string => {
        if (!actorId) return 'Unknown';
        if (actorId === 'player') return save.player.name;
        if (actorId === 'STATION') return 'PARC';
        return save.actors[actorId]?.name || actorId;
    };

    const resolveFactionName = (factionId?: string): string => {
        if (!factionId) return 'PARC';
        return save.factions[factionId]?.name || factionId;
    };

    const PARC_BACKGROUND_IMAGE = 'https://media.charhub.io/41b7b65d-839b-4d31-8c11-64ee50e817df/0fc1e223-ad07-41c4-bdae-c9545d5c5e34.png';

    const getAccent = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat':
            case 'stationStat':
                return (outcome.amount || 0) < 0
                    ? { border: 'rgba(255,80,80,0.32)', background: 'rgba(255,80,80,0.10)', color: '#ff7b7b' }
                    : { border: 'rgba(0,255,136,0.32)', background: 'rgba(0,255,136,0.10)', color: '#00ff88' };
            case 'roleChange':
                return { border: 'rgba(100,180,255,0.32)', background: 'rgba(100,180,255,0.10)', color: '#64b4ff' };
            case 'factionChange':
                return { border: 'rgba(255,200,0,0.32)', background: 'rgba(255,200,0,0.10)', color: '#ffc800' };
            case 'factionReputation':
                return (outcome.amount || 0) < 0
                    ? { border: 'rgba(255,80,80,0.32)', background: 'rgba(255,80,80,0.10)', color: '#ff5050' }
                    : { border: 'rgba(0,255,136,0.32)', background: 'rgba(0,255,136,0.10)', color: '#00ff88' };
            case 'newModule':
                return { border: 'rgba(99,102,241,0.32)', background: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.22) 50%, rgba(139,92,246,0.12) 100%)', color: '#a5b4fc' };
            case 'newOutfit':
                return { border: 'rgba(16,185,129,0.32)', background: 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(6,182,212,0.20) 50%, rgba(14,165,233,0.12) 100%)', color: '#10b981' };
            case 'movement':
                return { border: 'rgba(56,189,248,0.32)', background: 'linear-gradient(135deg, rgba(14,165,233,0.16) 0%, rgba(59,130,246,0.20) 50%, rgba(30,64,175,0.14) 100%)', color: '#38bdf8' };
            default:
                return { border: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)', color: '#fff' };
        }
    };

    const getOutcomeIcon = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat': {
                const statIcon = outcome.stat ? ACTOR_STAT_ICONS[outcome.stat as Stat] : undefined;
                return statIcon || ((outcome.amount || 0) < 0 ? TrendingDown : TrendingUp);
            }
            case 'stationStat': {
                const statIcon = outcome.stat ? STATION_STAT_ICONS[outcome.stat as StationStat] : undefined;
                return statIcon || ((outcome.amount || 0) < 0 ? TrendingDown : TrendingUp);
            }
            case 'roleChange':
                return Work;
            case 'factionChange':
            case 'factionReputation':
                return Handshake;
            case 'newModule':
                return DomainAdd;
            case 'newOutfit':
                return ContentCut;
            case 'movement':
                return outcome.factionId ? Output : Input;
            default:
                return TrendingUp;
        }
    };

    const getOutcomeTitle = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat':
            case 'stationStat':
                return outcome.stat ? String(outcome.stat).toUpperCase() : 'STAT CHANGE';
            case 'roleChange':
                return 'Role Change';
            case 'factionChange':
                return 'Faction Change';
            case 'factionReputation':
                return 'Reputation';
            case 'newModule':
                return 'New Module';
            case 'newOutfit':
                return 'New Outfit';
            case 'movement':
                return outcome.factionId ? `Visiting ${outcome.factionId}` : 'Returning';
        }
    }

    if (currentOutcomes.length === 0) {
        return null;
    }

    const renderStatEntries = (entries: Array<{ stat: Stat | StationStat; oldValue: number; newValue: number }>, cardIndex: number, isStation: boolean) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {entries.map((entry, statIndex) => {
                const isIncrease = entry.newValue > entry.oldValue;
                const isDecrease = entry.newValue < entry.oldValue;
                const StatIcon = isStation
                    ? STATION_STAT_ICONS[entry.stat as StationStat]
                    : ACTOR_STAT_ICONS[entry.stat as Stat];
                return (
                    <motion.div
                        key={String(entry.stat)}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.8 + cardIndex * 0.2 + statIndex * 0.1 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 4px',
                            background: isDecrease ? 'rgba(255,80,80,0.08)' : isIncrease ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: isDecrease ? '1px solid rgba(255,80,80,0.3)' : isIncrease ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {StatIcon && <StatIcon sx={{ fontSize: '1.2rem', color: isIncrease ? '#00ff88' : isDecrease ? '#ff6b6b' : '#fff', opacity: 0.9 }} />}
                            <Typography className="stat-label" sx={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>
                                {String(entry.stat)}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <span className="stat-grade" data-grade={scoreToGrade(entry.oldValue)} style={{ fontSize: '2rem', opacity: 0.6, filter: 'grayscale(0.5)' }}>
                                {scoreToGrade(entry.oldValue)}
                            </span>
                            <Typography sx={{ color: isDecrease ? '#ff5050' : isIncrease ? '#00ff88' : '#fff', fontWeight: 900, fontSize: '1.4rem', mx: 0.5, textShadow: isDecrease ? '0 2px 4px rgba(255,0,0,0.6)' : isIncrease ? '0 2px 4px rgba(0,255,0,0.6)' : '0 2px 4px rgba(0,0,0,0.6)' }}>
                                {isDecrease ? '↓' : isIncrease ? '↑' : '→'}
                            </Typography>
                            <motion.span
                                className="stat-grade"
                                data-grade={scoreToGrade(entry.newValue)}
                                style={{ fontSize: '2rem' }}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.9 + cardIndex * 0.2 + statIndex * 0.1 }}
                            >
                                {scoreToGrade(entry.newValue)}
                            </motion.span>
                        </Box>
                    </motion.div>
                );
            })}
        </Box>
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 64 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 64 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
                position: 'absolute',
                top: '2vh',
                right: '2vh',
                bottom: `2vh`,
                zIndex: 3,
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'flex-start',
                gap: '20px',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '0 20px'
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '30vmin',
                    height: '100%',
                    overflowY: 'auto'
                }}
            >
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
                                Outcome{currentOutcomes.length === 1 ? '' : 's'}
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
                            Closing the skit will accept these outcomes.
                        </Typography>
                    </Paper>
                </div>

                {/* Actor stat groups — one card per actor */}
                {actorStatGroups.map((group, groupIndex) => (
                    <div key={`actorStat_${group.actorId}`}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.5 + groupIndex * 0.2 }}
                        >
                            <Paper elevation={6} sx={{ background: 'rgba(10,20,30,0.95)', border: '2px solid rgba(0,255,136,0.15)', borderRadius: 3, p: 2, backdropFilter: 'blur(8px)', textAlign: 'center' }}>
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 + groupIndex * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Box sx={{
                                        width: '100%',
                                        height: '150px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: '2px solid rgba(0,255,136,0.4)',
                                        backgroundImage: group.actor ? `url(${group.actor.getEmotionImage(group.actor.getDefaultEmotion())})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: '50% 10%',
                                        backgroundRepeat: 'no-repeat',
                                        filter: 'brightness(1.1)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                                    }} />
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.7 + groupIndex * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Nameplate
                                        actor={group.actor}
                                        name={group.actor ? undefined : resolveActorName(group.actorId)}
                                        size="large"
                                        role={group.actor && layout ? (() => {
                                            const roleModules = layout.getModulesWhere((m: any) => m && m.type !== 'quarters' && m.ownerId === group.actor?.id);
                                            return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
                                        })() : undefined}
                                        layout="inline"
                                    />
                                </motion.div>
                                {renderStatEntries(group.entries, groupIndex, false)}
                            </Paper>
                        </motion.div>
                    </div>
                ))}

                {/* Station stat group — one card for PARC */}
                {stationStatEntries.length > 0 && (
                    <div key="stationStats">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.5 + actorStatGroups.length * 0.2 }}
                        >
                            <Paper elevation={6} sx={{ background: 'rgba(10,20,30,0.95)', border: '2px solid rgba(0,255,136,0.15)', borderRadius: 3, p: 2, backdropFilter: 'blur(8px)', textAlign: 'center' }}>
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 + actorStatGroups.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Box sx={{
                                        width: '100%',
                                        height: '150px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: '2px solid rgba(0,255,136,0.4)',
                                        backgroundImage: `url(${PARC_BACKGROUND_IMAGE})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: '50% 15%',
                                        backgroundRepeat: 'no-repeat',
                                        filter: 'brightness(1.1)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                                    }} />
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.7 + actorStatGroups.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Nameplate name="PARC" size="large" layout="inline" />
                                </motion.div>
                                {renderStatEntries(stationStatEntries, actorStatGroups.length, true)}
                            </Paper>
                        </motion.div>
                    </div>
                )}

                {/* Other outcomes — one card each */}
                {otherOutcomes.map((outcome, outcomeIndex) => {
                    const accent = getAccent(outcome);
                    const OutcomeIcon = getOutcomeIcon(outcome);
                    const cardTitle = getOutcomeTitle(outcome);
                    const cardIndex = actorStatGroups.length + (stationStatEntries.length > 0 ? 1 : 0) + outcomeIndex;

                    let content: React.ReactNode = null;

                    switch (outcome.type) {
                        case 'roleChange':
                            content = (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)', mb: 0.75 }}>
                                        {resolveActorName(outcome.actorId)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'left', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                                        Role set to {outcome.role && outcome.role.trim().length > 0 ? outcome.role : 'None'}
                                    </Typography>
                                </Box>
                            );
                            break;
                        case 'factionChange':
                            content = (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)', mb: 0.75 }}>
                                        {resolveActorName(outcome.actorId)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'left', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                                        Faction changed to {resolveFactionName(outcome.factionId)}
                                    </Typography>
                                </Box>
                            );
                            break;
                        case 'factionReputation':
                            const faction = outcome.factionId ? save.factions[outcome.factionId] : undefined;
                            const representative = faction?.representativeId ? save.actors[faction.representativeId] : undefined;
                            const oldReputation = Math.max(0, Math.min(10, faction?.reputation ?? 3));
                            const newReputation = Math.max(0, Math.min(10, oldReputation + (outcome.amount ?? 0)));
                            const isIncrease = newReputation > oldReputation;
                            const isDecrease = newReputation < oldReputation;
                            content = (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)', mb: 0.75 }}>
                                        {resolveFactionName(outcome.factionId)}
                                    </Typography>
                                    <Box sx={{
                                        width: '100%',
                                        height: '160px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: `2px solid ${accent.color}66`,
                                        backgroundImage: `url(${faction?.backgroundImageUrl || PARC_BACKGROUND_IMAGE})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                        position: 'relative',
                                        mb: 1.25
                                    }}>
                                        {representative && (
                                            <Box sx={{
                                                position: 'absolute',
                                                inset: 0,
                                                backgroundImage: `url(${representative.getEmotionImage(representative.getDefaultEmotion())})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: '50% 15%',
                                                backgroundRepeat: 'no-repeat'
                                            }} />
                                        )}
                                        <Box sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 100%)'
                                        }} />
                                    </Box>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 10px',
                                            background: isDecrease ? 'rgba(255,80,80,0.08)' : isIncrease ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            border: isDecrease ? '1px solid rgba(255,80,80,0.3)' : isIncrease ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        <Typography className="stat-label" sx={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            Reputation
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <span className="stat-grade" data-grade={scoreToGrade(oldReputation)} style={{ fontSize: '2rem', opacity: 0.6, filter: 'grayscale(0.5)' }}>
                                                {scoreToGrade(oldReputation)}
                                            </span>
                                            <Typography sx={{ color: isDecrease ? '#ff5050' : isIncrease ? '#00ff88' : '#fff', fontWeight: 900, fontSize: '1.4rem', mx: 0.5, textShadow: isDecrease ? '0 2px 4px rgba(255,0,0,0.6)' : isIncrease ? '0 2px 4px rgba(0,255,0,0.6)' : '0 2px 4px rgba(0,0,0,0.6)' }}>
                                                {isDecrease ? '↓' : isIncrease ? '↑' : '→'}
                                            </Typography>
                                            <span className="stat-grade" data-grade={scoreToGrade(newReputation)} style={{ fontSize: '2rem' }}>
                                                {scoreToGrade(newReputation)}
                                            </span>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                            break;
                        case 'newModule':
                            content = outcome.module ? (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)', mb: 0.75 }}>
                                        {outcome.module.moduleName}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'left', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                                        Role: {outcome.module.roleName}
                                        {'\n'}
                                        {outcome.module.description}
                                    </Typography>
                                </Box>
                            ) : null;
                            break;
                        case 'newOutfit':
                            content = outcome.outfit ? (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)', mb: 0.75 }}>
                                        {resolveActorName(outcome.outfit.actorId)}: {outcome.outfit.outfitName}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'left', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                                        {outcome.outfit.description}
                                    </Typography>
                                </Box>
                            ) : null;
                            break;
                        case 'movement': {
                            const actor = outcome.actorId ? save.actors[outcome.actorId] : undefined;
                            if (!actor) {
                                content = null;
                                console.log('Actor not found for movement outcome:', outcome);
                                break;
                            }

                            const actorIsAtFaction = !!save.factions[actor.locationId];
                            const actorIsNotAtFaction = !actorIsAtFaction;
                            const isReturnToParc = actorIsAtFaction && !!outcome.moduleId;
                            const isLeavingForFaction = actorIsNotAtFaction && !!outcome.factionId;

                            if (!isReturnToParc && !isLeavingForFaction) {
                                console.log('No need to display; actor is not moving between PARC and a faction:', outcome);
                                content = null;
                                break;
                            }

                            const currentFaction = save.factions[actor.locationId];
                            const destinationFaction = outcome.factionId ? save.factions[outcome.factionId] : undefined;
                            const message = isReturnToParc
                                ? `${actor.name} returns from ${currentFaction?.name || 'Unknown Faction'}`
                                : `${actor.name} Leaves for ${destinationFaction?.name || resolveFactionName(outcome.factionId)}`;

                            const backgroundImage = isReturnToParc
                                ? PARC_BACKGROUND_IMAGE
                                : destinationFaction?.backgroundImageUrl || PARC_BACKGROUND_IMAGE;

                            content = (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Box sx={{
                                        width: '100%',
                                        height: '160px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: `2px solid ${accent.color}66`,
                                        backgroundImage: `url(${backgroundImage})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                        position: 'relative',
                                        mb: 1.25
                                    }}>
                                        <Box sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            backgroundImage: `url(${actor.getEmotionImage(actor.getDefaultEmotion())})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: '50% 10%',
                                            backgroundRepeat: 'no-repeat'
                                        }} />
                                        <Box sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 100%)'
                                        }} />
                                    </Box>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-line', textAlign: 'left', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                                        {message}
                                    </Typography>
                                </Box>
                            );
                            break;
                        }
                    }

                    if (!content) {
                        return null;
                    }

                    const renderWithoutGenericWrapper = outcome.type === 'factionReputation';

                    return (
                        <div key={`${outcome.type}_${outcomeIndex}`}>
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.55 + cardIndex * 0.14 }}
                            >
                                {renderWithoutGenericWrapper ? (
                                    content
                                ) : (
                                    <Paper
                                        elevation={6}
                                        sx={{
                                            background: accent.background,
                                            border: `2px solid ${accent.border}`,
                                            borderRadius: 3,
                                            p: 2,
                                            backdropFilter: 'blur(8px)',
                                            textAlign: 'center',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 10, 20, 0.45)', zIndex: 0 }} />
                                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                                                <OutcomeIcon sx={{ color: accent.color, fontSize: '1.8rem' }} />
                                                <Typography
                                                    variant="h6"
                                                    sx={{
                                                        fontWeight: 800,
                                                        color: accent.color,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px',
                                                        textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                                    }}
                                                >
                                                    {cardTitle}
                                                </Typography>
                                            </Box>
                                            {content}
                                        </Box>
                                    </Paper>
                                )}
                            </motion.div>
                        </div>
                    );
                })}
            </Box>
        </motion.div>
    );
    
};

export default SkitOutcomeDisplay;
