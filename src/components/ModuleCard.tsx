import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Module } from '../Module';
import { Stage } from '../Stage';

interface ModuleCardProps {
    module: Module;
    stage: Stage;
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
 * Reusable module card component that displays module information.
 * Shows the module's background image with the assigned actor's portrait overlaid.
 */
export const ModuleCard: FC<ModuleCardProps> = ({
    module,
    stage,
    whileHover,
    style,
    className,
    onClick
}) => {
    const actor = module.ownerId ? stage.getSave().actors[module.ownerId] : null;
    const role = module.type === 'quarters' ? 'Occupant' : (module.getAttribute('role') || 'None');
    
    // Default hover behavior
    const defaultWhileHover = {
        x: 10,
        backgroundColor: 'rgba(176, 102, 255, 0.15)',
        borderColor: 'rgba(176, 102, 255, 0.5)',
    };

    return (
        <motion.div
            onClick={onClick}
            whileHover={whileHover || defaultWhileHover}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'relative',
                width: '100%',
                height: '80px',
                border: '3px solid #b066ff',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                display: 'flex',
                ...style
            }}
            className={className}
        >
            {/* Left side: Module image with actor portrait */}
            <div
                style={{
                    position: 'relative',
                    width: '80px',
                    height: '100%',
                    flexShrink: 0,
                    borderRight: '2px solid rgba(176, 102, 255, 0.3)',
                }}
            >
                {/* Module background image */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${actor?.decorImageUrls?.[module.type] || module.getAttribute('defaultImageUrl')})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                    }}
                />

                {/* Actor portrait overlay (if assigned) */}
                {actor && actor.isPrimaryImageReady && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: `url(${actor.getEmotionImage(actor.getDefaultEmotion(), stage)})`,
                            backgroundSize: 'contain',
                            backgroundPosition: 'top center',
                            backgroundRepeat: 'no-repeat',
                            opacity: 0.9,
                        }}
                    />
                )}
            </div>

            {/* Right side: Module info */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.6)',
                    overflow: 'hidden',
                }}
            >
                {/* Module name */}
                <div
                    style={{
                        color: '#b066ff',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        textTransform: 'capitalize',
                        textShadow: '0 1px 0 rgba(0,0,0,0.6)',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {module.getAttribute('name') || module.type}
                </div>

                {/* Role and assignment */}
                <div
                    style={{
                        color: actor ? '#ffc800' : '#b066ff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textShadow: '0 1px 0 rgba(0,0,0,0.6)',
                        opacity: actor ? 1 : 0.7,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {actor ? `${role}: ${actor.name}` : `${role}: Unassigned`}
                </div>
            </div>
        </motion.div>
    );
};

export default ModuleCard;
