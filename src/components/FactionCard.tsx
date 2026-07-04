import React, { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Faction from '../factions/Faction';
import Nameplate from './Nameplate';
import AuthorLink from './AuthorLink';
import { scoreToGrade } from '../utils';
import Actor from '../actors/Actor';

interface FactionCardProps {
    faction: Faction;
    representative?: Actor;
    /** Whether the card is expanded */
    isExpanded?: boolean;
    /** Custom hover animation properties */
    whileHover?: any;
    /** Additional styles */
    style?: React.CSSProperties;
    /** Additional class name */
    className?: string;
    /** onClick handler */
    onClick?: () => void;
}

/**
 * Reusable faction card component that displays faction information.
 * Collapsed state: Shows background image with overlaid nameplate and reputation meter.
 * Expanded state: Two-column layout with description + reputation on left, portrait on right.
 */
export const FactionCard: FC<FactionCardProps> = ({
    faction,
    representative,
    isExpanded: controlledExpanded,
    whileHover,
    style,
    className,
    onClick
}) => {
    const [internalExpanded, setInternalExpanded] = useState(false);
    const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
    
    const reputation = faction.reputation;
    const grade = scoreToGrade(reputation);
    const hasCutTies = reputation < 1;
    const isUnmet = !faction.active && !hasCutTies;

    const handleClick = () => {
        if (controlledExpanded === undefined) {
            setInternalExpanded(!internalExpanded);
        }
        onClick?.();
    };

    // Default hover behavior
    const defaultWhileHover = {
        x: 10,
        backgroundColor: 'rgba(176, 102, 255, 0.15)',
        borderColor: 'rgba(176, 102, 255, 0.5)',
    };

    return (
        <motion.div
            onClick={handleClick}
            whileHover={whileHover || defaultWhileHover}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            animate={{ 
                height: isExpanded ? 'auto' : '140px',
                opacity: (hasCutTies || isUnmet) ? 0.5 : 1
            }}
            style={{
                border: `3px solid ${hasCutTies ? '#ff6b6b' : (isUnmet ? '#888888' : '#b066ff')}`,
                borderRadius: '8px',
                background: hasCutTies ? 'rgba(255, 107, 107, 0.1)' : (isUnmet ? 'rgba(128, 128, 128, 0.1)' : 'rgba(0, 10, 20, 0.5)'),
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                ...style
            }}
            className={className}
        >
            {isExpanded ? (
                // EXPANDED STATE: Two-column layout
                <>
                    {/* Cut Ties Status Indicator */}
                    {hasCutTies && (
                        <div style={{
                            fontSize: 'clamp(0.65rem, 1.8vmin, 0.85rem)',
                            color: '#ff6b6b',
                            fontWeight: 700,
                            marginBottom: '8px',
                            padding: '4px 8px',
                            background: 'rgba(255, 107, 107, 0.2)',
                            borderRadius: '4px',
                            textAlign: 'center',
                            textShadow: '0 0 8px #ff6b6b',
                            border: '1px solid rgba(255, 107, 107, 0.5)',
                        }}>
                            ✂ CUT TIES
                        </div>
                    )}

                    {/* Unmet Status Indicator */}
                    {isUnmet && (
                        <div style={{
                            fontSize: 'clamp(0.65rem, 1.8vmin, 0.85rem)',
                            color: '#888888',
                            fontWeight: 700,
                            marginBottom: '8px',
                            padding: '4px 8px',
                            background: 'rgba(128, 128, 128, 0.2)',
                            borderRadius: '4px',
                            textAlign: 'center',
                            textShadow: '0 0 8px #888888',
                            border: '1px solid rgba(128, 128, 128, 0.5)',
                        }}>
                            ? UNMET
                        </div>
                    )}

                    {/* Nameplate at the top */}
                    <div style={{ 
                        padding: '8px 12px', 
                        display: 'flex', 
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.7)',
                        borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                        flexShrink: 0
                    }}>
                        <Nameplate 
                            name={faction.name}
                            size="small"
                            style={{
                                background: faction.themeColor || '#4a5568',
                                border: faction.themeColor ? `2px solid ${faction.themeColor}CC` : '2px solid #718096',
                                fontFamily: faction.themeFont || 'Arial, sans-serif',
                            }}
                        />
                    </div>

                    {/* Two-column layout: Description + Reputation (left) and Portrait (right) */}
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'row', 
                        overflow: 'hidden', 
                        flex: 1, 
                        minHeight: 0 
                    }}>
                        {/* Left column: Description and Reputation meter */}
                        <div
                            style={{
                                flex: '0 0 50%',
                                padding: '12px',
                                background: 'rgba(0, 0, 0, 0.8)',
                                borderRight: '2px solid rgba(176, 102, 255, 0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                overflowY: 'auto',
                            }}
                        >
                            {/* Description */}
                            <div style={{
                                color: '#b066ff',
                                fontSize: '0.8rem',
                                lineHeight: '1.4',
                                fontWeight: 600,
                                textShadow: '0 1px 0 rgba(0,0,0,0.6)',
                            }}>
                                {faction.description}
                            </div>

                            {/* Reputation section */}
                            <div style={{ marginTop: 'auto' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '8px',
                                }}>
                                    <span
                                        style={{
                                            fontSize: '0.85rem',
                                            color: '#b066ff',
                                            fontWeight: 700,
                                            textShadow: '0 1px 0 rgba(0,0,0,0.6)',
                                        }}
                                    >
                                        Reputation
                                    </span>
                                    
                                    {/* Grade Display */}
                                    <span
                                        className="stat-grade"
                                        data-grade={grade}
                                        style={{
                                            fontSize: '1.4rem',
                                            fontWeight: 900,
                                            textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px currentColor',
                                            lineHeight: 1,
                                            marginLeft: 'auto',
                                        }}
                                    >
                                        {grade}
                                    </span>
                                </div>
                                
                                {/* Ten-pip bar styled like station stats */}
                                <div style={{
                                    display: 'flex',
                                    gap: '2px',
                                    width: '100%',
                                }}>
                                    {Array.from({ length: 10 }, (_, i) => {
                                        const isLit = i < reputation;
                                        // Get color based on grade
                                        let pipColor = '#b066ff';
                                        if (grade.startsWith('F')) pipColor = '#ff6b6b';
                                        else if (grade.startsWith('D')) pipColor = '#ffb47a';
                                        else if (grade.startsWith('C')) pipColor = '#d0d0d0';
                                        else if (grade.startsWith('B')) pipColor = '#3bd3ff';
                                        else if (grade.startsWith('A')) pipColor = '#ffdd2f';
                                        
                                        return (
                                            <motion.div
                                                key={i}
                                                initial={{ scaleY: 0 }}
                                                animate={{ scaleY: 1 }}
                                                transition={{ delay: 0.05 * i }}
                                                style={{
                                                    flex: 1,
                                                    height: '4px',
                                                    borderRadius: '2px',
                                                    background: isLit 
                                                        ? pipColor
                                                        : 'rgba(255, 255, 255, 0.1)',
                                                    boxShadow: isLit 
                                                        ? `0 0 8px ${pipColor}, inset 0 1px 2px rgba(255, 255, 255, 0.3)`
                                                        : 'none',
                                                    border: isLit 
                                                        ? `1px solid ${pipColor}`
                                                        : '1px solid rgba(255, 255, 255, 0.2)',
                                                    transition: 'all 0.3s ease',
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right column: Portrait area with background image */}
                        <div
                            style={{
                                position: 'relative',
                                flex: 1,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Faction background image */}
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: faction.backgroundImageUrl ? `url(${faction.backgroundImageUrl})` : undefined,
                                    backgroundColor: faction.backgroundImageUrl ? undefined : 'rgba(0, 0, 0, 0.5)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                    filter: 'brightness(0.7)',
                                }}
                            />

                            {/* Representative portrait overlay (if available) */}
                            {representative && representative.isPrimaryImageReady && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundImage: `url(${representative.getEmotionImage(representative.getDefaultEmotion())})`,
                                        backgroundSize: 'contain',
                                        backgroundPosition: 'bottom center',
                                        backgroundRepeat: 'no-repeat',
                                        opacity: 0.95,
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Author link at bottom */}
                    {representative && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            padding: '8px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderTop: '2px solid rgba(176, 102, 255, 0.3)',
                            flexShrink: 0 
                        }}>
                            <AuthorLink actor={representative} />
                        </div>
                    )}
                </>
            ) : (
                // COLLAPSED STATE: Overlaid elements on background
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                    }}
                >
                    {/* Cut Ties Status Indicator */}
                    {hasCutTies && (
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 'clamp(0.65rem, 1.8vmin, 0.85rem)',
                            color: '#ff6b6b',
                            fontWeight: 700,
                            padding: '4px 12px',
                            background: 'rgba(255, 107, 107, 0.3)',
                            borderRadius: '4px',
                            textAlign: 'center',
                            textShadow: '0 0 8px #ff6b6b',
                            border: '1px solid rgba(255, 107, 107, 0.5)',
                            zIndex: 3,
                        }}>
                            ✂ CUT TIES
                        </div>
                    )}

                    {/* Unmet Status Indicator */}
                    {isUnmet && (
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 'clamp(0.65rem, 1.8vmin, 0.85rem)',
                            color: '#888888',
                            fontWeight: 700,
                            padding: '4px 12px',
                            background: 'rgba(128, 128, 128, 0.3)',
                            borderRadius: '4px',
                            textAlign: 'center',
                            textShadow: '0 0 8px #888888',
                            border: '1px solid rgba(128, 128, 128, 0.5)',
                            zIndex: 3,
                        }}>
                            ? UNMET
                        </div>
                    )}

                    {/* Faction background image */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: faction.backgroundImageUrl ? `url(${faction.backgroundImageUrl})` : undefined,
                            backgroundColor: faction.backgroundImageUrl ? undefined : 'rgba(0, 0, 0, 0.5)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            filter: 'brightness(0.7)',
                        }}
                    />

                    {/* Representative portrait overlay (if available) */}
                    {representative && representative.isPrimaryImageReady && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundImage: `url(${representative.getEmotionImage(representative.getDefaultEmotion())})`,
                                backgroundSize: 'contain',
                                backgroundPosition: 'bottom center',
                                backgroundRepeat: 'no-repeat',
                                opacity: 0.6,
                            }}
                        />
                    )}

                    {/* Nameplate overlay at the top */}
                    <div style={{ 
                        position: 'absolute',
                        top: (hasCutTies || isUnmet) ? '38px' : '8px',
                        left: '12px',
                        right: '12px',
                        display: 'flex', 
                        justifyContent: 'center',
                        zIndex: 2,
                    }}>
                        <Nameplate 
                            name={faction.name}
                            size="small"
                            style={{
                                background: faction.themeColor || '#4a5568',
                                border: faction.themeColor ? `2px solid ${faction.themeColor}CC` : '2px solid #718096',
                                fontFamily: faction.themeFont || 'Arial, sans-serif',
                            }}
                        />
                    </div>

                    {/* Reputation meter overlay at the bottom */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '12px',
                            right: '12px',
                            padding: '10px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            borderRadius: '6px',
                            border: '1px solid rgba(176, 102, 255, 0.3)',
                            zIndex: 2,
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '6px',
                        }}>
                            <span
                                style={{
                                    fontSize: '0.85rem',
                                    color: '#b066ff',
                                    fontWeight: 700,
                                    textShadow: '0 1px 0 rgba(0,0,0,0.6)',
                                }}
                            >
                                Reputation
                            </span>
                            
                            {/* Grade Display */}
                            <span
                                className="stat-grade"
                                data-grade={grade}
                                style={{
                                    fontSize: '1.4rem',
                                    fontWeight: 900,
                                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px currentColor',
                                    lineHeight: 1,
                                    marginLeft: 'auto',
                                }}
                            >
                                {grade}
                            </span>
                        </div>
                        
                        {/* Ten-pip bar styled like station stats */}
                        <div style={{
                            display: 'flex',
                            gap: '2px',
                            width: '100%',
                        }}>
                            {Array.from({ length: 10 }, (_, i) => {
                                const isLit = i < reputation;
                                // Get color based on grade
                                let pipColor = '#b066ff';
                                if (grade.startsWith('F')) pipColor = '#ff6b6b';
                                else if (grade.startsWith('D')) pipColor = '#ffb47a';
                                else if (grade.startsWith('C')) pipColor = '#d0d0d0';
                                else if (grade.startsWith('B')) pipColor = '#3bd3ff';
                                else if (grade.startsWith('A')) pipColor = '#ffdd2f';
                                
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        transition={{ delay: 0.05 * i }}
                                        style={{
                                            flex: 1,
                                            height: '4px',
                                            borderRadius: '2px',
                                            background: isLit 
                                                ? pipColor
                                                : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isLit 
                                                ? `0 0 8px ${pipColor}, inset 0 1px 2px rgba(255, 255, 255, 0.3)`
                                                : 'none',
                                            border: isLit 
                                                ? `1px solid ${pipColor}`
                                                : '1px solid rgba(255, 255, 255, 0.2)',
                                            transition: 'all 0.3s ease',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default FactionCard;
