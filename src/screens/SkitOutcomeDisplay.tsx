import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box } from '@mui/material';
import { TrendingUp, Handshake, TrendingDown, ContentCut } from '@mui/icons-material';
import { Stat, ACTOR_STAT_ICONS } from '../actors/Actor';
import { StationStat, STATION_STAT_ICONS } from '../Module';
import { accumulateOutcomes, Outcome, SkitData } from '../Skit';
import { Stage } from '../Stage';


interface SkitOutcomeDisplayProps {
    outcomes: Outcome[];
    stage: Stage;
    layout?: any;
    messageBoxTopVh?: number;
}

const SkitOutcomeDisplay: FC<SkitOutcomeDisplayProps> = ({ outcomes, stage, layout, messageBoxTopVh = 60 }) => {
    // Calculate bottom position based on message box top
    const bottomVh = Math.max(100 - messageBoxTopVh + 2, 15); // At least 15vh from bottom, 2vh padding above message box

    const currentOutcomes: Outcome[] = outcomes || [];
    const save = stage.getSave();

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

    const formatAmount = (amount?: number): string => {
        const value = amount || 0;
        return value > 0 ? `+${value}` : `${value}`;
    };

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
            case 'factionChange':
            case 'factionReputation':
                return Handshake;
            case 'newModule':
                return TrendingUp;
            case 'newOutfit':
                return ContentCut;
            default:
                return TrendingUp;
        }
    };

    if (currentOutcomes.length === 0) {
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
                bottom: `3%`,
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

                {currentOutcomes.map((outcome, outcomeIndex) => {
                    const accent = getAccent(outcome);
                    const OutcomeIcon = getOutcomeIcon(outcome);

                    let content: React.ReactNode = null;

                    switch (outcome.type) {
                        case 'actorStat': {
                            const StatIcon = outcome.stat ? ACTOR_STAT_ICONS[outcome.stat as Stat] : undefined;
                            content = (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textAlign: 'left', flex: 1 }}>
                                        {resolveActorName(outcome.actorId)}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'center' }}>
                                        {StatIcon ? <StatIcon sx={{ fontSize: '1.2rem', color: accent.color }} /> : null}
                                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: accent.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {String(outcome.stat || 'stat')}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: accent.color, textAlign: 'right', flex: 0.6 }}>
                                        {formatAmount(outcome.amount)}
                                    </Typography>
                                </Box>
                            );
                            break;
                        }
                        case 'stationStat': {
                            const StatIcon = outcome.stat ? STATION_STAT_ICONS[outcome.stat as StationStat] : undefined;
                            content = (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', textAlign: 'left', flex: 1 }}>
                                        PARC
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'center' }}>
                                        {StatIcon ? <StatIcon sx={{ fontSize: '1.2rem', color: accent.color }} /> : null}
                                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: accent.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {String(outcome.stat || 'station stat')}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: accent.color, textAlign: 'right', flex: 0.6 }}>
                                        {formatAmount(outcome.amount)}
                                    </Typography>
                                </Box>
                            );
                            break;
                        }
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
                            content = (
                                <Box sx={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: `1px solid ${accent.color}55` }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: accent.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)', mb: 0.75 }}>
                                        {resolveFactionName(outcome.factionId)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'left', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                                        Reputation {formatAmount(outcome.amount)}
                                    </Typography>
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
                    }

                    if (!content) {
                        return null;
                    }

                    return (
                        <div key={`${outcome.type}_${outcomeIndex}`}>
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.55 + outcomeIndex * 0.14 }}
                            >
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
                                                {outcome.type.replace(/([A-Z])/g, ' $1').trim()}
                                            </Typography>
                                        </Box>
                                        {content}
                                    </Box>
                                </Paper>
                            </motion.div>
                        </div>
                    );
                })}
            </Box>
        </motion.div>
    );
    
};

export default SkitOutcomeDisplay;
