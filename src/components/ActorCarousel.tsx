/*
 * A reusable component for displaying a horizontal carousel of actor cards.
 * Used by AttenuationScreen, EchoScreen, and optionally CryoScreen.
 * Supports both drag-and-drop and tap-to-select mechanisms for mobile.
 */
import React, { FC } from 'react';
import { motion } from 'framer-motion';
import Actor from '../actors/Actor';
import ActorCard, { ActorCardSection } from './ActorCard';
import { RemoveButton } from './RemoveButton';
import { Stage } from '../Stage';

interface ActorCarouselProps {
	actors: Actor[];
	stage: Stage;
	isVerticalLayout: boolean;
	expandedActorId: string | null;
	onExpandActor: (actorId: string | null) => void;
	
	// Optional props for customization
	borderColor?: string;
	glowColor?: string;
	showRemoveButton?: boolean;
	onRemoveActor?: (actorId: string, e: React.MouseEvent) => void;
	draggable?: boolean;
	onDragStart?: (e: React.DragEvent, actor: Actor) => void;
	onDrop?: (e: React.DragEvent) => void;
	onDragOver?: (e: React.DragEvent) => void;
	selectedActorId?: string | null;
	onActorClick?: (actorId: string) => void;
}

export const ActorCarousel: FC<ActorCarouselProps> = ({
	actors,
	stage,
	isVerticalLayout,
	expandedActorId,
	onExpandActor,
	borderColor = 'rgba(176,102,255,0.2)',
	glowColor = 'rgba(176, 102, 255, 0.4)',
	showRemoveButton = false,
	onRemoveActor,
	draggable = false,
	onDragStart,
	onDrop,
	onDragOver,
	selectedActorId = null,
	onActorClick
}) => {
	return (
		<div 
			style={{ 
				flex: '0 0 auto', 
				padding: '1vh', 
				borderBottom: `2px solid ${borderColor}`,
				background: 'rgba(0,0,0,0.3)',
				overflowX: 'auto',
				overflowY: 'hidden'
			}}
			onDrop={onDrop}
			onDragOver={onDragOver}
		>
			<div style={{ 
				display: 'flex', 
				gap: '1.2vmin', 
				justifyContent: 'center',
				minWidth: 'min-content',
				height: isVerticalLayout ? '32vh' : '22vh',
				paddingBottom: '0.5vh'
			}}>
				{actors.map((actor, index) => {
					const isExpanded = expandedActorId === actor.id;
					const isSelected = selectedActorId === actor.id;
					return (
						<motion.div
							key={`actor_${actor.id}`}
							style={{ 
								display: 'inline-block',
								position: 'relative',
								width: isVerticalLayout 
									? (isExpanded ? '48vmin' : (expandedActorId ? '24vmin' : '32vmin')) 
									: (isExpanded ? '32vmin' : (expandedActorId ? '12vmin' : '16vmin')),
								transition: 'width 0.3s ease'
							}}
							animate={{
								y: [0, -3, -1, -4, 0],
								x: [0, 1, -1, 0.5, 0],
								rotate: [0, 0.5, -0.3, 0.2, 0],
								scale: isSelected ? 1.08 : 1,
								transition: {
									duration: 6,
									repeat: Infinity,
									ease: "easeInOut",
									delay: 0.2 + index * 0.7,
									scale: {
										duration: 0.2,
										repeat: 0
									}
								}
							}}
							whileHover={{ 
								scale: isSelected ? 1.08 : 1.05,
								filter: 'brightness(1.1)',
								transition: {
									type: "spring",
									stiffness: 150,
									damping: 15
								}
							}}
							whileTap={{ scale: 0.99 }}
						>
							{showRemoveButton && onRemoveActor && (
								<RemoveButton
									onClick={(e: React.MouseEvent) => onRemoveActor(actor.id, e)}
									title="Remove from reserves"
									variant="topRight"
									size="small"
								/>
							)}
							<ActorCard
								actor={actor}
								visitingFaction={actor.isOffSite(stage.getSave()) ? stage.getSave().factions[actor.locationId] : undefined}
								collapsedSections={[ActorCardSection.PORTRAIT]}
								expandedSections={[ActorCardSection.PORTRAIT, ActorCardSection.STATS]}
								isExpanded={isExpanded}
								onClick={() => {
									if (onActorClick) {
										onActorClick(actor.id);
									} else {
										onExpandActor(isExpanded ? null : actor.id);
									}
								}}
								draggable={draggable}
								onDragStart={onDragStart ? (e) => onDragStart(e, actor) : undefined}
								style={{
									height: isVerticalLayout ? '30vh' : '20vh',
									boxShadow: isSelected 
										? `0 8px 24px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.5), inset 0 0 20px rgba(255,215,0,0.2)`
										: `0 6px 18px rgba(0,0,0,0.4), 0 0 20px ${actor.themeColor ? actor.themeColor + '66' : glowColor}`,
									padding: '8px',
									overflow: 'hidden',
									border: isSelected ? '3px solid rgba(255,215,0,0.9)' : undefined,
									transition: 'all 0.3s ease'
								}}
							/>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
};
