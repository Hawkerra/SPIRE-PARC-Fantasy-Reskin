import React, { act, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Typography, Card, CardContent, Tabs, Tab } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ScreenType } from './BaseScreen';
import { Layout, Module, createModule, ModuleType, MODULE_TEMPLATES, StationStat, STATION_STAT_DESCRIPTIONS, STATION_STAT_ICONS, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '../Module';
import { Stage } from '../Stage';
import ActorCard from '../components/ActorCard';
import ModuleCard from '../components/ModuleCard';
import FactionCard from '../components/FactionCard';
import { TurnIndicator as SharedTurnIndicator } from '../components/UIComponents';
import { useTooltip } from '../contexts/TooltipContext';
import { ContentManagementScreen } from './ContentManagementScreen';
import { SwapHoriz, Home, Work, Menu, HourglassBottom, HourglassTop, NotInterested, Delete } from '@mui/icons-material';
import { EditNote } from '@mui/icons-material';
import { SkitType } from '../Skit';
import Actor from '../actors/Actor';
import { generateActorDecor, getRole, isHologram } from '../actors/Actor';
import { scoreToGrade, assignActorToRole } from '../utils';

// Styled components for the day/turn display
const StyledDayCard = styled(Card)(({ theme }) => ({
    background: 'linear-gradient(135deg, rgba(176, 102, 255, 0.15) 0%, rgba(0, 200, 100, 0.08) 100%)',
    border: '2px solid #b066ff',
    borderRadius: '16px',
    marginBottom: '24px',
    overflow: 'visible',
    position: 'relative',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: '-2px',
        left: '-2px',
        right: '-2px',
        bottom: '-2px',
        background: 'linear-gradient(135deg, #b066ff 0%, rgba(176, 102, 255, 0.3) 100%)',
        borderRadius: '18px',
        zIndex: -1,
        filter: 'blur(4px)',
        opacity: 0.6,
    }
}));

interface StationScreenProps {
    stage: () => Stage;
    setScreenType: (type: ScreenType) => void;
    isVerticalLayout: boolean;
}

export const StationScreen: FC<StationScreenProps> = ({stage, setScreenType, isVerticalLayout}) => {
    const [expandedMenu, setExpandedMenu] = React.useState<string | null>('patients');
    const [previousExpandedMenu, setPreviousExpandedMenu] = React.useState<string | null>(null);
    const [showContentManagement, setShowContentManagement] = React.useState(false);
    const [day, setDay] = React.useState<number>(stage().getSave().day);
    const [turn, setTurn] = React.useState<number>(stage().getSave().turn);

    const [layout, setLayout] = React.useState<Layout>(stage()?.getLayout());
    const hasCheckedBeginingSkit = React.useRef<boolean>(false);
    
    // Module selection state
    const [showModuleSelector, setShowModuleSelector] = React.useState(false);
    const [selectedPosition, setSelectedPosition] = React.useState<{x: number, y: number} | null>(null);
    
    // Drag and drop state
    const [draggedModule, setDraggedModule] = React.useState<{module: Module, fromX: number, fromY: number} | null>(null);
    const [draggedActor, setDraggedActor] = React.useState<any | null>(null);
    const [hoveredModuleId, setHoveredModuleId] = React.useState<string | null>(null);
    const [justDroppedModuleId, setJustDroppedModuleId] = React.useState<string | null>(null);
    const [hoveredActorId, setHoveredActorId] = React.useState<string | null>(null);
    const [isHoveringDeleteZone, setIsHoveringDeleteZone] = React.useState<boolean>(false);
    const [currentDragPosition, setCurrentDragPosition] = React.useState<{x: number, y: number} | null>(null);
    const deleteZoneRef = React.useRef<HTMLDivElement>(null);

    // Tooltip context
    const { setTooltip, clearTooltip } = useTooltip();

    const gridWidth = layout.gridWidth;
    const gridHeight = layout.gridHeight;
    
    // Reference to grid container for dynamic sizing
    const gridContainerRef = React.useRef<HTMLDivElement>(null);
    const [cellSize, setCellSize] = React.useState<string>(isVerticalLayout ? '8.5vh' : '12vh');
    
    // Calculate cell size dynamically based on available space
    React.useEffect(() => {
        const updateCellSize = () => {
            if (!gridContainerRef.current) return;
            
            const container = gridContainerRef.current;
            const rect = container.getBoundingClientRect();
            
            // Calculate the maximum cell size that fits in the available space
            // while maintaining the grid dimensions
            const maxCellWidth = rect.width / gridWidth;
            // Account for header bar height (approximately 80px including margins and content)
            const availableHeight = rect.height - 80;
            const maxCellHeight = availableHeight / gridHeight;
            
            // Use the smaller of the two to ensure the entire grid fits
            const cellSizePx = Math.min(maxCellWidth, maxCellHeight);
            setCellSize(`${cellSizePx}px`);
        };
        
        // Update on mount and window resize
        updateCellSize();
        window.addEventListener('resize', updateCellSize);
        
        // Also update when layout changes (orientation change)
        const timeoutId = setTimeout(updateCellSize, 100);
        
        return () => {
            window.removeEventListener('resize', updateCellSize);
            clearTimeout(timeoutId);
        };
    }, [isVerticalLayout, gridWidth, gridHeight]);
    
    const gridEdgeSize = isVerticalLayout ? '12vh' : '0';

    const getActorsAtModule = (module: Module): Actor[] => {
        const save = stage().getSave();
        const actorsAtLocation = Object.values(save.actors).filter(actor => actor.locationId === module.id);

        if (module.type !== 'comms') {
            return actorsAtLocation;
        }

        const commsVisitors = (save.commsVisitors || [])
            .map(actorId => save.actors[actorId])
            .filter((actor): actor is Actor => !!actor);

        return Array.from(new Map([...actorsAtLocation, ...commsVisitors].map(actor => [actor.id, actor])).values());
    };

    const openModuleSelector = (x: number, y: number) => {
        setSelectedPosition({x, y});
        setShowModuleSelector(true);
    };

    const addModule = (moduleType: ModuleType, x: number, y: number) => {
        console.log(`Adding module of type ${moduleType} at ${x}, ${y}`);
        const newModule: Module = createModule(moduleType);
        
        // Deduct cost from station stats
        const moduleDefaults = MODULE_TEMPLATES[moduleType];
        if (!moduleDefaults) {
            console.error(`Module type ${moduleType} not found in defaults or templates`);
            return;
        }
        
        const cost = moduleDefaults.cost || {};
        const save = stage().getSave();
        
        if (!save.stationStats) {
            return;
        }
        
        for (const [stat, costValue] of Object.entries(cost)) {
            if (save.stationStats[stat as StationStat] !== undefined) {
                save.stationStats[stat as StationStat] = Math.max(1, save.stationStats[stat as StationStat] - costValue);
            }
        }
        
        // Write into the Stage's layout
        stage().getLayout().setModuleAt(x, y, newModule);
        
        // Log to timeline
        const moduleName = newModule.getAttribute('name') || moduleType;
        stage().pushToTimeline(save, `Added ${moduleName} module to the PARC`);
        
        // update local layout state so this component re-renders with the new module
        setLayout(stage().getLayout());
        setShowModuleSelector(false);
        setSelectedPosition(null);
        // Possibly kick off a skit about the new module, if no others exist in layout:
        const existingModules = stage().getLayout().getModulesWhere(m => m.type === moduleType);
        if (existingModules.length === 1 && Object.values(stage().getSave().actors).filter(actor => !actor.factionId && !actor.isOffSite(save)).length > 0) { // New module is the only one of its type
            // Grab a few random patients to pull to the new module for a skit:
            let randomPatients = Object.values(stage().getSave().actors).filter(actor => !actor.factionId && !actor.isOffSite(save))
                .filter(a => a.locationId !== newModule.id && !a.factionId)
                .sort(() => 0.5 - Math.random());
            randomPatients = randomPatients.slice(0, Math.min(Math.random() * 3 + 1, randomPatients.length));
            randomPatients.forEach(p => {
                p.locationId = newModule.id;
            });

            stage().setSkit({
                type: SkitType.NEW_MODULE,
                moduleId: newModule.id,
                script: [],
                context: { moduleType }
            });
            setScreenType(ScreenType.SKIT);
        } else {
            stage().incTurn(1, setScreenType);
        }
    };

    const getAvailableModules = (): ModuleType[] => {
        // Combine built-in and custom modules
        const allModuleTypes = Object.keys(MODULE_TEMPLATES);
        
        return allModuleTypes.filter(moduleType => {
            const moduleDefaults = MODULE_TEMPLATES[moduleType];
            
            const available = moduleDefaults.available;
            
            // Check if available() returns true
            if (available && !available(stage())) {
                return false;
            }
            
            // Check if requirements are met
            const requirements = moduleDefaults.cost || {};
            const stationStats = stage().getSave().stationStats;
            
            if (!stationStats) {
                // If no station stats exist, all requirements are considered unmet
                return Object.keys(requirements).length === 0;
            }
            
            for (const [stat, requiredValue] of Object.entries(requirements)) {
                const currentValue = stationStats[stat as StationStat] || 1;
                if (currentValue < requiredValue + 1) {
                    return false;
                }
            }
            
            return true;
        }) as ModuleType[];
    };

    const getUnaffordableModules = (): ModuleType[] => {
        // Get modules that are available but not affordable
        const allModuleTypes = Object.keys(MODULE_TEMPLATES);
        
        return allModuleTypes.filter(moduleType => {
            const moduleDefaults = MODULE_TEMPLATES[moduleType];
            
            const available = moduleDefaults.available;
            
            // Check if available() returns true
            if (available && !available(stage())) {
                return false;
            }
            
            // Check if requirements are NOT met (unaffordable)
            const requirements = moduleDefaults.cost || {};
            const stationStats = stage().getSave().stationStats;
            
            if (!stationStats) {
                // If no station stats exist, all with costs are unaffordable
                return Object.keys(requirements).length > 0;
            }
            
            for (const [stat, requiredValue] of Object.entries(requirements)) {
                const currentValue = stationStats[stat as StationStat] || 1;
                if (currentValue < requiredValue + 1) {
                    return true; // Unaffordable
                }
            }
            
            return false; // Is affordable
        }) as ModuleType[];
    };

    const handleModuleDragStart = (module: Module, x: number, y: number) => {
        setDraggedModule({module, fromX: x, fromY: y});
        setTooltip(`Moving ${module.getAttribute('name') || module.type} module`, SwapHoriz);
    };

    const handleModuleDrop = (toX: number, toY: number) => {
        if (!draggedModule) return;
        
        const {fromX, fromY, module} = draggedModule;
        
        // Don't do anything if dropped on same position
        if (fromX === toX && fromY === toY) {
            setDraggedModule(null);
            clearTooltip();
            return;
        }
        
        const targetModule = layout.getModuleAt(toX, toY);
        
        // Swap modules if target has a module
        if (targetModule) {
            stage().getLayout().setModuleAt(fromX, fromY, targetModule);
            stage().getLayout().setModuleAt(toX, toY, module);
        } else {
            // Move to empty space
            stage().getLayout().setModuleAt(fromX, fromY, null as any);
            stage().getLayout().setModuleAt(toX, toY, module);
        }
        
        setLayout(stage().getLayout());
        setDraggedModule(null);
        clearTooltip();
    };

    const handleModuleDelete = () => {
        if (!draggedModule) return;
        
        const {fromX, fromY, module} = draggedModule;
        
        // Only allow deleting unowned modules
        if (module.ownerId) {
            console.log(`Cannot delete module ${module.getAttribute('name') || module.type} - it has an owner (${module.ownerId})`);
            setDraggedModule(null);
            setIsHoveringDeleteZone(false);
            clearTooltip();
            return;
        }
        
        // Remove the module from the layout
        stage().getLayout().removeModuleAt(fromX, fromY);
        
        // Log to timeline
        const moduleName = module.getAttribute('name') || module.type;
        stage().pushToTimeline(stage().getSave(), `Removed ${moduleName} module from the PARC`);
        
        setLayout(stage().getLayout());
        setDraggedModule(null);
        setIsHoveringDeleteZone(false);
        clearTooltip();
        
        console.log(`Deleted module ${module.getAttribute('name') || module.type} at (${fromX}, ${fromY})`);
    };

    const handleActorDropOnModule = (actorId: string, targetModule: Module) => {
        const actor = stage().getSave().actors[actorId];
        // No actor found, or actor is off-site or in invalid location
        if (!actor || (actor.locationId && !stage().getSave().layout.getModuleById(actor.locationId))) return;
        let turnCost = 0;

        if (targetModule.type === 'quarters') {
            // Handle quarters assignment with swapping
            const currentQuartersId = actor.locationId;
            const targetOwnerId = targetModule.ownerId;

            if (targetOwnerId !== actorId) {
                turnCost = 1;
            }

            // If target quarters has an owner, swap them
            if (targetOwnerId && targetOwnerId !== actorId) {
                const otherActor = stage().getSave().actors[targetOwnerId];
                if (otherActor && currentQuartersId) {
                    // Find current quarters module
                    const currentQuarters = layout.getModuleById(currentQuartersId);
                    if (currentQuarters && currentQuarters.type === 'quarters') {
                        // Swap: other actor gets current quarters
                        currentQuarters.ownerId = targetOwnerId;
                        if (!otherActor.isOffSite(stage().getSave())) {
                            otherActor.locationId = currentQuartersId;
                        }
                    }
                }
            } else {
                // If the new quarters was unoccupied, then no one was swapped and we need to clear this character's current quarters before assigning them here.
                layout.getLayout().flat().forEach(module => {
                    if (module && module.type === 'quarters' && module.ownerId === actorId) {
                        module.ownerId = undefined;
                    }
                });
            }

            // Assign actor to target quarters
            targetModule.ownerId = actorId;
            if (!actor.isOffSite(stage().getSave())) {
                actor.locationId = targetModule.id;
            }
            generateActorDecor(actor, targetModule, stage());

        } else {
            if (targetModule.ownerId !== actorId) {
                turnCost = 1;
            }

            // Use centralized role assignment logic
            assignActorToRole(stage(), actor, targetModule, layout);
            
            if (!actor.isOffSite(stage().getSave())) {
                actor.locationId = targetModule.id;
            }
            generateActorDecor(actor, targetModule, stage());
            const roleName: string = targetModule.getAttribute('role') || '';
            if (roleName && Object.keys(actor.heldRoles).indexOf(roleName) === -1) {
                // This character has never held this role before; kick off a little skit about it.
                turnCost = 0; // The skit will advance the turn.
                stage().setSkit({
                    type: SkitType.ROLE_ASSIGNMENT,
                    moduleId: targetModule.id,
                    actorId: actorId,
                    script: [],
                    context: { role: roleName }
                });
                setScreenType(ScreenType.SKIT);
            }
        }

        // Show drop animation feedback
        setJustDroppedModuleId(targetModule.id);
        setTimeout(() => setJustDroppedModuleId(null), 500);

        // Update layout to trigger re-render
        setLayout(stage().getLayout());
        setDraggedActor(null);
        setHoveredModuleId(null);
        if (turnCost > 0) {
            stage().incTurn(turnCost, setScreenType);
        }
    };

    // Poll for changes to day/turn/layout
    React.useEffect(() => {
        const interval = setInterval(() => {
            const stageInstance = stage();
            const currentSave = stageInstance.getSave();
            const currentLayout = stageInstance.getLayout();
            
            // Update state if changed
            if (currentSave.day !== day) setDay(currentSave.day);
            if (currentSave.turn !== turn) setTurn(currentSave.turn);
            if (currentLayout !== layout) setLayout(currentLayout);
        }, 100);
        
        return () => clearInterval(interval);
    }, [day, turn, layout]);

    // Check for beginning skit on mount
    React.useEffect(() => {
        if (!hasCheckedBeginingSkit.current) {
            hasCheckedBeginingSkit.current = true;
            checkAndStartBeginingSkit();
        }
    }, []);

    // Handle Escape key to open menu
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !showContentManagement) {
                setScreenType(ScreenType.MENU);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setScreenType, showContentManagement]);

    // Check if drag position is over delete zone
    React.useEffect(() => {
        if (!currentDragPosition || !draggedModule || !deleteZoneRef.current) {
            if (isHoveringDeleteZone) {
                setIsHoveringDeleteZone(false);
                if (draggedModule) {
                    setTooltip(`Moving ${draggedModule.module.getAttribute('name') || draggedModule.module.type} module`, SwapHoriz);
                }
            }
            return;
        }

        const deleteZoneRect = deleteZoneRef.current.getBoundingClientRect();
        const isOverDeleteZone = (
            currentDragPosition.x >= deleteZoneRect.left &&
            currentDragPosition.x <= deleteZoneRect.right &&
            currentDragPosition.y >= deleteZoneRect.top &&
            currentDragPosition.y <= deleteZoneRect.bottom
        );

        if (isOverDeleteZone !== isHoveringDeleteZone) {
            setIsHoveringDeleteZone(isOverDeleteZone);
            if (isOverDeleteZone) {
                setTooltip(`Remove ${draggedModule.module.getAttribute('name') || draggedModule.module.type}`, Delete);
            } else {
                setTooltip(`Moving ${draggedModule.module.getAttribute('name') || draggedModule.module.type} module`, SwapHoriz);
            }
        }
    }, [currentDragPosition, draggedModule, isHoveringDeleteZone]);

    const checkAndStartBeginingSkit = () => {
        const save = stage().getSave();
        console.log('Checking for beginning skit conditions...');
        if (save.day == 1 && save.aide.actorId && !save.timeline?.some(s => s.skit?.type === SkitType.BEGINNING)) {
            console.log('Starting beginning skit...');
            const module = save.layout.getModulesWhere(m => m.type === 'echo chamber')[0];
            const stationAide = save.actors[save.aide.actorId || ''];
            stationAide.locationId = module.id;

            stage().setSkit({
                type: SkitType.BEGINNING,
                actorId: save.aide.actorId,
                moduleId: module.id,
                script: [],
                context: {}
            });
            setScreenType(ScreenType.SKIT);
        } else {
            console.log('No beginning skit needed.');
        }
    };

    const renderDayTurnDisplay = () => {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOutBack" }}
            >
                <StyledDayCard elevation={4}>
                    <CardContent sx={{ textAlign: 'center', padding: '20px !important' }}>
                        {/* Day Number */}
                        <motion.div
                            key={day} // Re-animate when day changes
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.4, ease: "easeOutBack" }}
                        >
                            <Typography
                                variant="h4"
                                component="div"
                                sx={{
                                    fontWeight: 900,
                                    fontSize: '2.2rem',
                                    color: '#b066ff',
                                    textShadow: '0 0 20px rgba(176, 102, 255, 0.5)',
                                    letterSpacing: '0.05em',
                                    marginBottom: '4px',
                                }}
                            >
                                DAY {day}
                            </Typography>
                        </motion.div>
                        
                        {/* Turn Indicator */}
                        <SharedTurnIndicator currentTurn={turn} totalTurns={4} />
                    </CardContent>
                </StyledDayCard>
            </motion.div>
        );
    };

    // Helper function to get relevant modules for an actor
    const getActorRelatedModules = (actorId: string | null) => {
        if (!actorId) return { locationId: null, homeId: null, workId: null };
        
        const actor = stage().getSave().actors[actorId];
        if (!actor) return { locationId: null, homeId: null, workId: null };
        
        // Current location
        const locationId = actor.locationId;
        
        // Home quarters (quarters type with ownerId matching actor)
        const homeModule = layout.getModulesWhere(m => 
            m.type === 'quarters' && m.ownerId === actorId
        )[0];
        const homeId = homeModule?.id || null;
        
        // Work assignment (non-quarters type with ownerId matching actor)
        const workModule = layout.getModulesWhere(m => 
            m.type !== 'quarters' && m.ownerId === actorId
        )[0];
        const workId = workModule?.id || null;
        
        return { locationId, homeId, workId };
    };

    // Helper function to determine if a module is interactable
    const isModuleInteractable = (module: Module | null): boolean => {
        if (!module) return false;

        // Any module with an action (including generic fallback actions) is interactable.
        return !!module.getAction();
    };

    const renderGrid = () => {
        const cells: React.ReactNode[] = [];
        
        // Get related modules for the hovered/dragged actor
        const activeActorId = draggedActor?.id || hoveredActorId;
        const { locationId, homeId, workId } = getActorRelatedModules(activeActorId);
        
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const module = layout.getModuleAt(x, y);
                
                // Check if this module should be highlighted
                const isHighlighted = module && (
                    module.id === locationId ||
                    module.id === homeId ||
                    module.id === workId
                );
                const isHome = module && module.id === homeId;
                const isWork = module && module.id === workId;
                const isInteractable = isModuleInteractable(module);
                cells.push(
                    <div
                        key={`cell_${x}-${y}`}
                        className="grid-cell"
                        style={{
                            position: 'absolute',
                            left: `calc(${x} * ${cellSize})`,
                            top: `calc(${y} * ${cellSize})`,
                            width: cellSize,
                            height: cellSize,
                            boxSizing: 'border-box',
                            padding: 3,
                            zIndex: draggedModule?.module.id === module?.id ? 1000 : 1,
                        }}
                    >
                        {module ? (
                            <motion.div
                                key={module.id}
                                layoutId={module.id}
                                className={`module module-${module.type}`}
                                initial={{ scale: 0 }}
                                animate={{ 
                                    scale: justDroppedModuleId === module.id ? 1.15 : 1,
                                    boxShadow: hoveredModuleId === module.id && draggedActor 
                                        ? `0 0 40px rgba(176, 102, 255, 0.8), inset 0 0 30px rgba(176, 102, 255, 0.3)`
                                        : justDroppedModuleId === module.id
                                            ? `0 0 50px rgba(176, 102, 255, 1), inset 0 0 40px rgba(176, 102, 255, 0.5)`
                                            : isHighlighted
                                                ? `0 0 25px rgba(255, 200, 0, 0.8), inset 0 0 20px rgba(255, 200, 0, 0.2)`
                                                : undefined,
                                    x: 0,
                                    y: 0
                                }}
                                transition={{
                                    scale: { duration: 0.2 },
                                    boxShadow: { duration: 0.2 },
                                    layout: { duration: 0.3, ease: "easeInOut" },
                                    x: { duration: 0.3, ease: "easeOut" },
                                    y: { duration: 0.3, ease: "easeOut" }
                                }}
                                whileHover={{ scale: draggedActor ? 1.08 : 1.03 }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: isHighlighted 
                                        ? '3px solid rgba(255, 200, 0, 0.9)' 
                                        : isInteractable
                                            ? '3px solid rgba(176, 102, 255, 0.9)'
                                            : '3px solid #006644',
                                    borderRadius: 10,
                                    background: `url(${stage().getSave().actors[module.ownerId || '']?.decorImageUrls[module.type] || module.getAttribute('defaultImageUrl')}) center center / contain no-repeat`,
                                    cursor: 'pointer',
                                    color: '#ecdfff',
                                    fontWeight: 700,
                                    fontSize: '18px',
                                    textTransform: 'capitalize',
                                    textShadow: '0 1px 0 rgba(0,0,0,0.6)',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}
                                drag={!draggedActor}
                                dragMomentum={false}
                                dragElastic={0}
                                dragSnapToOrigin={true}
                                onDragStart={() => {
                                    handleModuleDragStart(module, x, y);
                                    setCurrentDragPosition(null);
                                }}
                                onDrag={(event, info) => {
                                    // Track current drag position
                                    setCurrentDragPosition({ x: info.point.x, y: info.point.y });
                                }}
                                onDragOver={(e) => {
                                    if (draggedActor) {
                                        e.preventDefault();
                                        setHoveredModuleId(module.id);
                                        
                                        // Update tooltip with assignment message
                                        const actor = draggedActor;
                                        if (actor.locationId && !stage().getSave().layout.getModuleById(actor.locationId)) {
                                            // Actor is off-site or in invalid location; cannot be assigned
                                            setTooltip(`Cannot assign ${actor.name} (off-station)`, NotInterested);
                                        }
                                        else if (module.type === 'quarters') {
                                            if (module.ownerId === actor.id) {
                                                setTooltip(`${actor.name} is already assigned here.`, Home);
                                            } else if (!module.ownerId) {
                                                setTooltip(`Assign ${actor.name} to new quarters.`, Home);
                                            } else {
                                                const otherActor = stage().getSave().actors[module.ownerId]?.name || 'occupant';
                                                setTooltip(`Swap ${actor.name}'s assignment with ${otherActor}.`, SwapHoriz);
                                            }
                                        } else {
                                            const role = module.getAttribute('role') || module.type;
                                            if (module.ownerId === actor.id) {
                                                setTooltip(`${actor.name} is already assigned as ${role}.`, Work);
                                            } else if (!module.ownerId) {
                                                setTooltip(`Assign ${actor.name} to ${role}.`, Work);
                                            } else {
                                                const otherActor = stage().getSave().actors[module.ownerId]?.name || 'occupant';
                                                setTooltip(`Swap ${actor.name} with current ${role}, ${otherActor}.`, SwapHoriz);
                                            }
                                        }
                                    } else if (draggedModule && draggedModule.module.id !== module.id) {
                                        // Show swap tooltip when dragging one module over another
                                        e.preventDefault();
                                        setTooltip(`Swap ${draggedModule.module.getAttribute('name') || draggedModule.module.type} with ${module.getAttribute('name') || module.type}`, SwapHoriz);
                                    }
                                }}
                                onDragLeave={() => {
                                    if (draggedActor) {
                                        setHoveredModuleId(null);
                                        clearTooltip();
                                    } else if (draggedModule) {
                                        // Restore the "Moving module" tooltip when leaving another module
                                        setTooltip(`Moving ${draggedModule.module.getAttribute('name') || draggedModule.module.type} module`, SwapHoriz);
                                    }
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedActor) {
                                        handleActorDropOnModule(draggedActor.id, module);
                                        clearTooltip();
                                    }
                                }}
                                onDragEnd={(event, info) => {
                                    // Clear drag position tracking
                                    setCurrentDragPosition(null);
                                    
                                    // If hovering delete zone, handle deletion
                                    if (isHoveringDeleteZone) {
                                        handleModuleDelete();
                                        return;
                                    }
                                    
                                    // Calculate which cell we're over based on drag position
                                    const gridContainer = document.querySelector('.station-modules');
                                    if (!gridContainer) {
                                        clearTooltip();
                                        return;
                                    }
                                    
                                    const rect = gridContainer.getBoundingClientRect();
                                    const cellSizeNum = rect.width / gridWidth;
                                    
                                    // Get pointer position relative to grid
                                    const relX = info.point.x - rect.left;
                                    const relY = info.point.y - rect.top;
                                    
                                    const dropX = Math.floor(relX / cellSizeNum);
                                    const dropY = Math.floor(relY / cellSizeNum);
                                    
                                    // Validate drop position
                                    if (dropX >= 0 && dropX < gridWidth && dropY >= 0 && dropY < gridHeight) {
                                        handleModuleDrop(dropX, dropY);
                                    } else {
                                        setDraggedModule(null);
                                        clearTooltip();
                                    }
                                }}
                                onClick={(e) => {
                                    // Only trigger action if not dragging
                                    if (draggedModule) return;
                                    
                                    // Trigger module action if defined
                                    const action = module.getAction();
                                    if (action) {
                                        action(module, stage(), setScreenType);
                                    }
                                }}
                            >
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    {/* Icon overlays for home and work modules */}
                                    {isHome && !draggedModule && (
                                        <div style={{
                                            position: 'absolute',
                                            top: `calc(${cellSize} * 0.08)`,
                                            right: `calc(${cellSize} * 0.08)`,
                                            background: 'rgba(0, 0, 0, 0.7)',
                                            borderRadius: '50%',
                                            padding: `calc(${cellSize} * 0.05)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                            border: `calc(${cellSize} * 0.02) solid rgba(255, 200, 0, 0.8)`,
                                        }}>
                                            <Home style={{ color: '#ffc800', fontSize: `calc(${cellSize} * 0.12)` }} />
                                        </div>
                                    )}
                                    {isWork && !draggedModule && (
                                        <div style={{
                                            position: 'absolute',
                                            top: `calc(${cellSize} * 0.08)`,
                                            right: `calc(${cellSize} * 0.08)`,
                                            background: 'rgba(0, 0, 0, 0.7)',
                                            borderRadius: '50%',
                                            padding: `calc(${cellSize} * 0.05)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                            border: `calc(${cellSize} * 0.02) solid rgba(255, 200, 0, 0.8)`,
                                        }}>
                                            <Work style={{ color: '#ffc800', fontSize: `calc(${cellSize} * 0.12)` }} />
                                        </div>
                                    )}
                                    {/* Compute actors once for this module */}
                                    {(() => {
                                        const actors = getActorsAtModule(module);
                                        const actorCount = actors.length;
                                        return (
                                            <>
                                                {/* Actor strip: spaced evenly across the tile, aligned to the bottom (slightly above the label) */}
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    pointerEvents: 'none',
                                                }}>
                                                    {actors.map((actor, index) => {
                                                        // Calculate horizontal position: space evenly from their centers
                                                        // For single actor: center at 50%
                                                        // For multiple: distribute evenly across the width
                                                        const leftPercent = actorCount === 1 
                                                            ? 50 
                                                            : (100 / (actorCount + 1)) * (index + 1);
                                                        
                                                        return (
                                                            <img
                                                                key={actor.id}
                                                                src={actor.getEmotionImage(actor.getDefaultEmotion(), stage())}
                                                                alt={actor.name}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${leftPercent}%`,
                                                                    bottom: 0,
                                                                    transform: 'translateX(-50%)',
                                                                    height: `calc(0.6 * ${cellSize})`,
                                                                    userSelect: 'none',
                                                                    pointerEvents: 'none',
                                                                    filter: isHologram(actor, stage().getSave(), actor.locationId || '') ? 'opacity(0.65) saturate(45%) brightness(1.2) drop-shadow(0 0 6px rgba(176, 102, 255, 0.9))' : undefined,
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>

                                                {/* Label bar: shaded, spans full width, overlays above actors (z-index) and is bottom-aligned */}
                                                <div 
                                                    className="module-label"
                                                    style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        right: 0,
                                                        bottom: '6px',
                                                        width: '100%',
                                                        background: 'rgba(0,0,0,0.6)',
                                                        padding: `calc(${cellSize} * 0.05) calc(${cellSize} * 0.06)`,
                                                        textAlign: 'center',
                                                        pointerEvents: 'none',
                                                        zIndex: 2,
                                                        fontSize: (() => {
                                                            const labelText = module.getAttribute('name') || module.type;
                                                            // Scale font size based on cell size (more responsive to small screens)
                                                            const baseSize = `calc(${cellSize} * 0.12)`;
                                                            // Scale down more aggressively for long labels
                                                            if (labelText.length > 20) return `calc(${cellSize} * 0.08)`;
                                                            if (labelText.length > 15) return `calc(${cellSize} * 0.09)`;
                                                            if (labelText.length > 12) return `calc(${cellSize} * 0.10)`;
                                                            return baseSize;
                                                        })(),
                                                        opacity: isInteractable ? 1 : 0.4,
                                                        transition: 'opacity 0.3s ease',
                                                    }}
                                                >{module.getAttribute('name') || module.type}</div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        ) : null}

                        {/* Render + placeholders for adjacent empty spaces as a full darkened dotted box. Test that there is a neighboring module */}
                        {layout.getLayout().flat().some(m => {
                            const {x: mx, y: my} = layout.getModuleCoordinates(m);
                            // Check if adjacent and not the dragged module's original position
                            const isAdjacent = Math.abs(mx - x) + Math.abs(my - y) === 1;
                            const isDraggedOrigin = draggedModule && draggedModule.fromX === x && draggedModule.fromY === y;
                            return isAdjacent && !isDraggedOrigin;
                        }) && !module && (
                            <motion.div
                                className="add-module-placeholder"
                                onClick={() => openModuleSelector(x, y)}
                                onDragOver={(e) => e.preventDefault()}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 10,
                                    background: 'rgba(0,0,0,0.45)',
                                    border: '3px dashed rgba(176, 102, 255, 0.9)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.95)',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontSize: isVerticalLayout ? '2.5vh' : '3vh', lineHeight: 1, fontWeight: 800, userSelect: 'none' }}>+</div>
                            </motion.div>
                        )}
                    </div>
                );
            }
        }
        return cells;
    }

    const save = stage().getSave();
    const stationActors = Object.values(save.actors).filter(actor => {
        if (save.aide.actorId === actor.id || ['cryo', 'dead'].includes(actor.locationId)) {
            return false;
        }

        // Keep existing non-faction patients and include faction actors that are physically present on station.
        return !actor.factionId || !!layout.getModuleById(actor.locationId);
    });

    const getActorVisitingStatus = (actor: any) => {
        const visitingFaction = actor.isOffSite(save) ? save.factions[actor.locationId] : undefined;
        const visitingFromFaction = !visitingFaction && actor.factionId && layout.getModuleById(actor.locationId)
            ? save.factions[actor.factionId]
            : undefined;

        return { visitingFaction, visitingFromFaction };
    };

    return (
        <div className="station-screen" style={{ 
            display: 'flex', 
            flexDirection: isVerticalLayout ? 'column' : 'row',
            height: '100vh', 
            width: '100vw', 
            overflow: 'hidden' 
        }}>
            {/* Main Grid Area */}
            <div
                ref={gridContainerRef}
                className="station-grid-container"
                style={{
                    width: isVerticalLayout ? '100vw' : '80vw',
                    height: isVerticalLayout ? '45vh' : '100vh',
                    boxSizing: 'border-box',
                    background: 'linear-gradient(45deg, #140a20 0%, #002244 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Station Stats Display with Menu Button - Top Bar */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    style={{
                        flexShrink: 0,
                        margin: '1vh',
                        display: 'flex',
                        gap: '0',
                        padding: '0.3vmin 0.5vmin',
                        background: 'linear-gradient(135deg, rgba(0, 30, 60, 0.85) 0%, rgba(18, 8, 32, 0.85) 100%)',
                        border: '2px solid #b066ff',
                        borderRadius: '12px',
                        boxShadow: '0 0 30px rgba(176, 102, 255, 0.3), inset 0 0 20px rgba(176, 102, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 90,
                    }}
                >
                    {/* Stats Container - Left Column */}
                    <div style={{
                        flex: '1',
                        display: 'flex',
                        flexWrap: isVerticalLayout ? 'wrap' : 'nowrap',
                        gap: '0.5vmin',
                        alignItems: 'flex-start',
                    }}>
                        {Object.values(StationStat).map((statName) => {
                            const statValue = stage().getSave().stationStats?.[statName] || 5;
                            const grade = scoreToGrade(statValue);
                            const StatIcon = STATION_STAT_ICONS[statName];
                            return (
                                <motion.div
                                    key={statName}
                                    whileHover={{ scale: 1.05, y: -3 }}
                                    onMouseEnter={() => setTooltip(STATION_STAT_DESCRIPTIONS[statName], StatIcon)}
                                    onMouseLeave={() => clearTooltip()}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.3vmin',
                                        width: isVerticalLayout ? 'calc(33.333% - 0.4vmin)' : 'calc(16.666% - 0.5vmin)',
                                        padding: '0.5vmin',
                                        boxSizing: 'border-box',
                                        userSelect: 'none',
                                    }}
                                >
                                    {/* Stat Name and Grade - Inline */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.3vmin',
                                        width: '100%',
                                    }}>
                                        {/* Stat Icon */}
                                        <StatIcon style={{ 
                                            fontSize: isVerticalLayout ? '2vmin' : '1.5vmin',
                                            color: '#b066ff',
                                            flexShrink: 0,
                                        }} />
                                        
                                        <span
                                            className="stat-label"
                                            style={{
                                                fontSize: isVerticalLayout ? '1.5vmin' : '1.5vmin',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {statName}
                                        </span>
                                        
                                        {/* Grade Display */}
                                        <span
                                            className="stat-grade"
                                            data-grade={grade}
                                            style={{
                                                fontSize: isVerticalLayout ? '3vmin' : '2.2vmin',
                                                fontWeight: 900,
                                                textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px currentColor',
                                                lineHeight: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {grade}
                                        </span>
                                    </div>
                                    
                                    {/* Ten-pip bar */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.1vmin',
                                        width: '100%',
                                    }}>
                                        {Array.from({ length: 10 }, (_, i) => {
                                            const isLit = i < statValue;
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
                                                    transition={{ delay: 0.5 + (i * 0.05) }}
                                                    style={{
                                                        flex: 1,
                                                        height: isVerticalLayout ? '0.6vmin' : '0.4vmin',
                                                        minHeight: '2px',
                                                        borderRadius: '1px',
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
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Menu Button - Right Column */}
                    {/* Top-right icon buttons */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '0.6vh',
                        minWidth: '40px',
                        marginLeft: '0.8vh',
                    }}>
                        <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {setScreenType(ScreenType.MENU)}}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#b066ff',
                            }}
                            onMouseEnter={() => setTooltip('Main Menu', Menu)}
                            onMouseLeave={() => clearTooltip()}
                        >
                            <Menu style={{ fontSize: '28px' }} />
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowContentManagement(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#b066ff',
                            }}
                            onMouseEnter={() => setTooltip('Content Management', EditNote)}
                            onMouseLeave={() => clearTooltip()}
                        >
                            <EditNote style={{ fontSize: '28px' }} />
                        </motion.button>
                    </div>
                </motion.div>
                
                {/* Grid wrapper - takes remaining space */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    minHeight: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {/* Station modules (background grid moved onto this element so it moves with the centered content) */}
                    <div
                        className="station-modules"
                        style={{
                            width: `calc(${gridWidth} * ${cellSize})`,
                            height: `calc(${gridHeight} * ${cellSize})`,
                            // move the subtle grid onto the centered modules container so lines align with cells
                            backgroundImage: `
                                linear-gradient(rgba(176, 102, 255, 0.08) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(176, 102, 255, 0.08) 1px, transparent 1px)
                            `,
                            backgroundSize: `${cellSize} ${cellSize}`,
                            backgroundPosition: '0 0',
                            backgroundRepeat: 'repeat',
                            position: 'relative',
                            zIndex: 51
                        }}
                    >
                        {renderGrid()}
                    </div>
                </div>

                {/* Deletion Zone - appears in bottom-right corner when dragging unowned modules */}
                <AnimatePresence>
                    {draggedModule && !draggedModule.module.ownerId && 
                     !['echo chamber', 'comms', 'generator', 'director module'].includes(draggedModule.module.type) && (
                        <motion.div
                            ref={deleteZoneRef}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ 
                                opacity: 1, 
                                scale: isHoveringDeleteZone ? 1.1 : 1,
                            }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                position: 'absolute',
                                bottom: isVerticalLayout ? '2vh' : '4vh',
                                right: isVerticalLayout ? '2vh' : '4vh',
                                width: isVerticalLayout ? '12vh' : '10vh',
                                height: isVerticalLayout ? '12vh' : '10vh',
                                borderRadius: '20px',
                                background: isHoveringDeleteZone 
                                    ? 'linear-gradient(135deg, rgba(255, 50, 50, 0.9) 0%, rgba(200, 0, 0, 0.9) 100%)'
                                    : 'linear-gradient(135deg, rgba(255, 50, 50, 0.6) 0%, rgba(200, 0, 0, 0.6) 100%)',
                                border: isHoveringDeleteZone ? '3px solid #ff3333' : '3px dashed #ff6666',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isHoveringDeleteZone
                                    ? '0 0 40px rgba(255, 50, 50, 0.8), inset 0 0 30px rgba(255, 100, 100, 0.3)'
                                    : '0 0 20px rgba(255, 50, 50, 0.5)',
                                backdropFilter: 'blur(10px)',
                                cursor: 'pointer',
                                zIndex: 50,
                                pointerEvents: 'auto',
                            }}
                        >
                            <Delete 
                                style={{ 
                                    fontSize: isVerticalLayout ? '5vh' : '4vh',
                                    color: '#ffffff',
                                    marginBottom: '0.5vh',
                                    filter: isHoveringDeleteZone ? 'drop-shadow(0 0 10px #ffffff)' : 'none',
                                }} 
                            />
                            <Typography
                                style={{
                                    color: '#ffffff',
                                    fontSize: isVerticalLayout ? '1.4vh' : '1.2vh',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Delete
                            </Typography>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Side Menu (right side for horizontal, bottom for vertical) */}
            <div
                className="station-menu"
                style={{
                    width: isVerticalLayout ? '100vw' : '20vw',
                    height: isVerticalLayout ? '50vh' : '100vh',
                    boxSizing: 'border-box',
                    background: 'rgba(18, 8, 32, 0.9)',
                    borderLeft: isVerticalLayout ? 'none' : '2px solid #b066ff',
                    borderTop: isVerticalLayout ? '2px solid #b066ff' : 'none',
                    padding: isVerticalLayout ? '10px' : '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Enhanced Day and Turn Display - hide in vertical layout */}
                {!isVerticalLayout && renderDayTurnDisplay()}

                {isVerticalLayout ? (
                    // Vertical layout: Tabbed interface
                    <>
                        {/* Compact Day/Turn Display for Vertical Layout */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '0.3vh 1vh',
                            borderBottom: '1px solid rgba(176, 102, 255, 0.3)',
                        }}>
                            <Typography
                                sx={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: '#b066ff',
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Day {day}
                            </Typography>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                {Array.from({ length: 4 }, (_, i) => {const Icon = i < turn ? HourglassTop : HourglassBottom; return (
                                    <Icon
                                        key={i}
                                        sx={{
                                            fontSize: '0.9rem',
                                            color: i < turn ? 'rgba(176, 102, 255, 0.3)' : '#b066ff',
                                            transition: 'color 0.3s ease',
                                        }}
                                    />
                                )})}
                            </div>
                        </div>
                        
                        {/* Material UI Tabs */}
                        <Tabs
                            value={expandedMenu || 'patients'}
                            onChange={(e, newValue) => setExpandedMenu(newValue)}
                            variant="fullWidth"
                            sx={{
                                minHeight: '36px',
                                '& .MuiTab-root': {
                                    minHeight: '36px',
                                    height: '36px',
                                    padding: '6px 16px',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: '#b066ff',
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    lineHeight: 1,
                                    '&.Mui-selected': {
                                        color: '#b066ff',
                                    },
                                },
                                '& .MuiTabs-indicator': {
                                    backgroundColor: '#b066ff',
                                    height: '3px',
                                },
                            }}
                        >
                            <Tab label="RESIDENTS" value="patients" />
                            <Tab label="ROOMS" value="modules" />
                            <Tab label="FACTIONS" value="factions" />
                        </Tabs>
                        {/* Tab content */}
                        <div style={{ 
                            flex: '1 1 auto',
                            overflowY: 'auto',
                            minHeight: 0,
                        }}>
                            {expandedMenu === 'patients' && (
                                <div style={{ 
                                    padding: '0.5vh',
                                    alignItems: 'flex-start',
                                    ...(isVerticalLayout && {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '0.5vh',
                                    }),
                                }}>
                                    {stationActors.length === 0 ? (
                                        <p style={{ color: '#b066ff', opacity: 0.5, fontStyle: 'italic', fontSize: '0.85rem', fontWeight: 700, margin: 0, ...(isVerticalLayout && { gridColumn: '1 / -1' }) }}>Visit the Summoning Sanctum to summon your first residents. </p>
                                    ) : (
                                        stationActors.map((actor: any) => {
                                            const { visitingFaction, visitingFromFaction } = getActorVisitingStatus(actor);
                                            return (
                                                <div 
                                                    key={actor.id}
                                                    onMouseEnter={() => setHoveredActorId(actor.id)}
                                                    onMouseLeave={() => setHoveredActorId(null)}
                                                >
                                                    <ActorCard
                                                        actor={actor}
                                                        role={getRole(actor, save)}
                                                        visitingFaction={visitingFaction}
                                                        visitingFromFaction={visitingFromFaction}
                                                        isDragging={draggedActor?.id === actor.id}
                                                        draggable={true}
                                                        onDragStart={(e: React.DragEvent) => {
                                                            setDraggedActor(actor);
                                                            setHoveredActorId(null);
                                                            e.dataTransfer.effectAllowed = 'move';
                                                        }}
                                                        onDragEnd={() => {
                                                            setDraggedActor(null);
                                                            setHoveredModuleId(null);
                                                            setHoveredActorId(null);
                                                            clearTooltip();
                                                        }}
                                                        whileHover={{
                                                            backgroundColor: 'rgba(176, 102, 255, 0.15)',
                                                            borderColor: 'rgba(176, 102, 255, 0.5)',
                                                            x: isVerticalLayout ? 5 : 10
                                                        }}
                                                        style={{
                                                            marginBottom: '0',
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                            {expandedMenu === 'modules' && (
                                <div style={{ 
                                    padding: '0.5vh',
                                    alignItems: 'flex-start',
                                    ...(isVerticalLayout && {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '0.5vh',
                                    }),
                                }}>
                                    {layout.getModulesWhere(m => true).length === 0 ? (
                                        <p style={{ 
                                            color: '#b066ff', 
                                            opacity: 0.5, 
                                            fontStyle: 'italic', 
                                            fontSize: '0.85rem', 
                                            fontWeight: 700,
                                            margin: 0,
                                            ...(isVerticalLayout && { gridColumn: '1 / -1' }),
                                        }}>No modules currently on station</p>
                                    ) : (
                                        layout.getModulesWhere(m => true)
                                            .sort((a: Module, b: Module) => a.type.localeCompare(b.type))
                                            .map((module: Module) => (
                                                <ModuleCard
                                                    key={module.id}
                                                    module={module}
                                                    stage={stage()}
                                                    onClick={() => {
                                                        const action = module.getAction();
                                                        if (action) {
                                                            action(module, stage(), setScreenType);
                                                        }
                                                    }}
                                                    style={{
                                                        marginBottom: '0',
                                                    }}
                                                />
                                            ))
                                    )}
                                </div>
                            )}
                            {expandedMenu === 'factions' && (
                                <div style={{ 
                                    padding: '0.5vh',
                                    alignItems: 'flex-start',
                                    ...(isVerticalLayout && {
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '0.5vh',
                                    }),
                                }}>
                                    {Object.values(stage().getSave().factions)/*.filter(f => f.active)*/.length === 0 ? (
                                        <p style={{ 
                                            color: '#b066ff', 
                                            opacity: 0.5, 
                                            fontStyle: 'italic', 
                                            fontSize: '0.85rem', 
                                            fontWeight: 700,
                                            margin: 0,
                                            ...(isVerticalLayout && { gridColumn: '1 / -1' }),
                                        }}>No factions in contact.</p>
                                    ) : (
                                        Object.values(stage().getSave().factions)/*.filter(f => f.active)*/.map((faction) => (
                                            <FactionCard
                                                key={faction.id}
                                                faction={faction}
                                                representative={stage().getSave().actors[faction.representativeId || '']}
                                                onClick={() => {
                                                    console.log(`Clicked faction ${faction.name}`);
                                                }}
                                                style={{
                                                    marginBottom: '0',
                                                }}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    // Horizontal layout: Original expandable sections
                    ['Patients', 'Modules', 'Factions'].map(item => {
                        const itemKey = item.toLowerCase();
                        const isExpanded = expandedMenu === itemKey;
                        const isContracting = previousExpandedMenu === itemKey && !isExpanded;
                        const [isHeaderHovered, setIsHeaderHovered] = React.useState(false);
                        
                        return (
                            <motion.div 
                                key={item} 
                                style={{ 
                                    margin: '10px 0',
                                    flex: isExpanded ? '1 1 auto' : '0 0 auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0,
                                }}
                                animate={{ x: (isHeaderHovered && isExpanded) ? 10 : 0 }}
                                transition={{ x: { duration: 0.2, ease: 'easeOut' } }}
                            >
                                <motion.button
                                    onClick={() => {
                                        setPreviousExpandedMenu(expandedMenu);
                                        setExpandedMenu(isExpanded ? null : itemKey);
                                    }}
                                    onMouseEnter={() => setIsHeaderHovered(true)}
                                    onMouseLeave={() => setIsHeaderHovered(false)}
                                    animate={{ x: (isHeaderHovered && !isExpanded) ? 10 : 0 }}
                                    transition={{ x: { duration: 0.2, ease: 'easeOut' } }}
                                    whileTap={{ scale: 0.95 }}
                                    className="section-header"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        padding: '15px',
                                        background: isExpanded
                                            ? 'rgba(176, 102, 255, 0.2)'
                                            : 'transparent',
                                        border: '3px solid #b066ff',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '1rem',
                                    }}
                                >
                                    <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>{item}</span>
                                    <span style={{ 
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease'
                                    }}>▼</span>
                                </motion.button>
                            
                            {/* Expandable content */}
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ 
                                    height: isExpanded ? 'auto' : 0,
                                    opacity: isExpanded ? 1 : 0
                                }}
                                transition={{ 
                                    height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                                    opacity: { duration: isExpanded ? 0.25 : 0.15, delay: isExpanded ? 0.05 : 0, ease: 'easeInOut' }
                                }}
                                style={{ 
                                    overflow: isExpanded ? 'visible' : 'hidden',
                                    background: 'rgba(18, 8, 32, 0.7)',
                                    border: isExpanded ? '2px solid rgba(176, 102, 255, 0.3)' : 'none',
                                    borderTop: 'none',
                                    borderRadius: '0 0 5px 5px',
                                    flex: isExpanded ? '1 1 auto' : '0 0 auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0,
                                }}
                                onAnimationComplete={() => {
                                    // Clear previous expanded state once animation is complete
                                    if (isContracting) {
                                        setPreviousExpandedMenu(null);
                                    }
                                }}
                            >
                                {/* Always render content, but with conditional styling for visibility */}
                                {itemKey === 'patients' && (
                                    <div style={{ padding: '15px', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                                        {stationActors.length === 0 ? (
                                            <p style={{ color: '#b066ff', opacity: 0.5, fontStyle: 'italic', fontSize: '0.85rem', fontWeight: 700 }}>Visit the Echo Chamber to bring on new patients!</p>
                                        ) : (
                                            stationActors.map((actor: any) => {
                                                const { visitingFaction, visitingFromFaction } = getActorVisitingStatus(actor);
                                                return (
                                                    <div 
                                                        key={actor.id}
                                                        onMouseEnter={() => setHoveredActorId(actor.id)}
                                                        onMouseLeave={() => setHoveredActorId(null)}
                                                    >
                                                        <ActorCard
                                                            actor={actor}
                                                            role={getRole(actor, save)}
                                                            visitingFaction={visitingFaction}
                                                            visitingFromFaction={visitingFromFaction}
                                                            isDragging={draggedActor?.id === actor.id}
                                                            draggable={true}
                                                            onDragStart={(e: React.DragEvent) => {
                                                                setDraggedActor(actor);
                                                                setHoveredActorId(null);
                                                                e.dataTransfer.effectAllowed = 'move';
                                                            }}
                                                            onDragEnd={() => {
                                                                setDraggedActor(null);
                                                                setHoveredModuleId(null);
                                                                setHoveredActorId(null);
                                                                clearTooltip();
                                                            }}
                                                            whileHover={{
                                                                backgroundColor: 'rgba(176, 102, 255, 0.15)',
                                                                borderColor: 'rgba(176, 102, 255, 0.5)',
                                                                x: 10
                                                            }}
                                                            style={{
                                                                marginBottom: '15px',
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                                {itemKey === 'modules' && (
                                    <div style={{ padding: '15px', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                                        {layout.getModulesWhere(m => true).length === 0 ? (
                                            <p style={{ 
                                                color: '#b066ff', 
                                                opacity: 0.5, 
                                                fontStyle: 'italic', 
                                                fontSize: '0.85rem', 
                                                fontWeight: 700
                                            }}>No modules currently on station</p>
                                        ) : (
                                            layout.getModulesWhere(m => true)
                                                .sort((a: Module, b: Module) => a.type.localeCompare(b.type))
                                                .map((module: Module) => (
                                                    <ModuleCard
                                                        key={module.id}
                                                        module={module}
                                                        stage={stage()}
                                                        onClick={() => {
                                                            const action = module.getAction();
                                                            if (action) {
                                                                action(module, stage(), setScreenType);
                                                            }
                                                        }}
                                                        style={{
                                                            marginBottom: '15px',
                                                        }}
                                                    />
                                                ))
                                        )}
                                    </div>
                                )}
                                {itemKey === 'factions' && (
                                    
                                    <div style={{ padding: '15px', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                                        {Object.values(stage().getSave().factions)/*.filter(f => f.active)*/.length === 0 ? (
                                            <p style={{ 
                                                color: '#b066ff', 
                                                opacity: 0.5, 
                                                fontStyle: 'italic', 
                                                fontSize: '0.85rem', 
                                                fontWeight: 700 
                                            }}>No factions in contact.</p>
                                        ) : (
                                            Object.values(stage().getSave().factions)/*.filter(f => f.active)*/.map((faction) => (
                                                <FactionCard
                                                    key={faction.id}
                                                    faction={faction}
                                                    representative={stage().getSave().actors[faction.representativeId || '']}
                                                    onClick={() => {
                                                        console.log(`Clicked faction ${faction.name}`);
                                                    }}
                                                    style={{
                                                        marginBottom: '15px',
                                                    }}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    );
                })
                )}

                
            </div>

            {/* Module Selection Modal */}
            <AnimatePresence>
                {showModuleSelector && selectedPosition && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowModuleSelector(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'linear-gradient(135deg, rgba(0, 30, 60, 0.95) 0%, rgba(18, 8, 32, 0.95) 100%)',
                                border: '3px solid #b066ff',
                                borderRadius: '20px',
                                padding: '30px',
                                maxWidth: '80vw',
                                maxHeight: '80vh',
                                overflow: 'auto',
                                boxShadow: '0 0 40px rgba(176, 102, 255, 0.3)',
                            }}
                        >
                            <Typography
                                variant="h4"
                                style={{
                                    color: '#b066ff',
                                    marginBottom: '20px',
                                    textAlign: 'center',
                                    textShadow: '0 0 10px rgba(176, 102, 255, 0.5)',
                                    fontWeight: 900,
                                }}
                            >
                                Add a Module
                            </Typography>
                            
                            {/* Affordable Modules */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '20px',
                                marginTop: '20px',
                            }}>
                                {getAvailableModules().map((moduleType) => {
                                    const moduleDefaults = MODULE_TEMPLATES[moduleType];
                                    if (!moduleDefaults) return null;
                                    
                                    const cost = moduleDefaults.cost || {};
                                    const hasCost = Object.keys(cost).length > 0;
                                    
                                    return (
                                        <motion.div
                                            key={moduleType}
                                            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(176, 102, 255, 0.5)' }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => addModule(moduleType, selectedPosition.x, selectedPosition.y)}
                                            style={{
                                                background: `url(${moduleDefaults.defaultImageUrl}) center center / cover`,
                                                border: '2px solid #b066ff',
                                                borderRadius: '10px',
                                                padding: '15px',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                minHeight: '150px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'flex-end',
                                            }}
                                        >
                                            <div style={{
                                                background: 'rgba(0, 0, 0, 0.8)',
                                                padding: '10px',
                                                borderRadius: '5px',
                                                textAlign: 'center',
                                            }}>
                                                <Typography
                                                    variant="h6"
                                                    style={{
                                                        color: '#b066ff',
                                                        textTransform: 'capitalize',
                                                        fontWeight: 700,
                                                        fontSize: '1rem',
                                                    }}
                                                >
                                                    {moduleDefaults.name}
                                                </Typography>
                                                {moduleDefaults.role && (
                                                    <Typography
                                                        variant="body2"
                                                        style={{
                                                            color: '#b066ff',
                                                            opacity: 0.7,
                                                            fontSize: '0.85rem',
                                                            marginTop: '4px',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {moduleDefaults.role}
                                                    </Typography>
                                                )}
                                                {hasCost && (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        marginTop: '8px',
                                                        flexWrap: 'wrap',
                                                    }}>
                                                        {Object.entries(cost).map(([stat, value]) => {
                                                            const StatIcon = STATION_STAT_ICONS[stat as StationStat];
                                                            return (
                                                                <div
                                                                    key={stat}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        color: '#ff6666',
                                                                        fontSize: '0.9rem',
                                                                        fontWeight: 700,
                                                                    }}
                                                                >
                                                                    <StatIcon style={{ fontSize: '1rem' }} />
                                                                    <span>-{value}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                            
                            {/* Unaffordable Modules */}
                            {getUnaffordableModules().length > 0 && (
                                <>
                                    <Typography
                                        variant="h5"
                                        style={{
                                            color: '#666',
                                            marginTop: '30px',
                                            marginBottom: '10px',
                                            textAlign: 'center',
                                            fontWeight: 700,
                                        }}
                                    >
                                        Insufficient Resources
                                    </Typography>
                                    
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                        gap: '20px',
                                        marginTop: '10px',
                                    }}>
                                        {getUnaffordableModules().map((moduleType) => {
                                            const moduleDefaults = MODULE_TEMPLATES[moduleType];
                                            if (!moduleDefaults) return null;
                                            
                                            const cost = moduleDefaults.cost || {};
                                            const hasCost = Object.keys(cost).length > 0;
                                            
                                            return (
                                                <div
                                                    key={moduleType}
                                                    style={{
                                                        background: `url(${moduleDefaults.defaultImageUrl}) center center / cover`,
                                                        border: '2px solid #444',
                                                        borderRadius: '10px',
                                                        padding: '15px',
                                                        cursor: 'not-allowed',
                                                        position: 'relative',
                                                        minHeight: '150px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end',
                                                        opacity: 0.4,
                                                        filter: 'grayscale(0.5)',
                                                    }}
                                                >
                                                    <div style={{
                                                        background: 'rgba(0, 0, 0, 0.8)',
                                                        padding: '10px',
                                                        borderRadius: '5px',
                                                        textAlign: 'center',
                                                    }}>
                                                        <Typography
                                                            variant="h6"
                                                            style={{
                                                                color: '#666',
                                                                textTransform: 'capitalize',
                                                                fontWeight: 700,
                                                                fontSize: '1rem',
                                                            }}
                                                        >
                                                            {moduleDefaults.name}
                                                        </Typography>
                                                        {moduleDefaults.role && (
                                                            <Typography
                                                                variant="body2"
                                                                style={{
                                                                    color: '#666',
                                                                    opacity: 0.7,
                                                                    fontSize: '0.85rem',
                                                                    marginTop: '4px',
                                                                    fontWeight: 700,
                                                                }}
                                                            >
                                                                {moduleDefaults.role}
                                                            </Typography>
                                                        )}
                                                        {hasCost && (
                                                            <div style={{
                                                                display: 'flex',
                                                                justifyContent: 'center',
                                                                gap: '8px',
                                                                marginTop: '8px',
                                                                flexWrap: 'wrap',
                                                            }}>
                                                                {Object.entries(cost).map(([stat, value]) => {
                                                                    const StatIcon = STATION_STAT_ICONS[stat as StationStat];
                                                                    const stationStats = stage().getSave().stationStats;
                                                                    const currentValue = stationStats?.[stat as StationStat] || 1;
                                                                    const isInsufficient = currentValue < value + 1;
                                                                    
                                                                    return (
                                                                        <div
                                                                            key={stat}
                                                                            style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px',
                                                                                color: isInsufficient ? '#ff3333' : '#666',
                                                                                fontSize: '0.9rem',
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            <StatIcon style={{ fontSize: '1rem' }} />
                                                                            <span>-{value}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                            
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowModuleSelector(false)}
                                style={{
                                    marginTop: '30px',
                                    padding: '12px 30px',
                                    background: 'transparent',
                                    border: '2px solid #b066ff',
                                    borderRadius: '8px',
                                    color: '#b066ff',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'block',
                                    marginLeft: 'auto',
                                    marginRight: 'auto',
                                }}
                            >
                                Cancel
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showContentManagement && (
                <ContentManagementScreen
                    stage={stage}
                    onClose={() => setShowContentManagement(false)}
                />
            )}
        </div>
    );
}
