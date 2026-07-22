import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Stage, SaveType } from '../Stage';
import { BlurredBackground } from '../components/BlurredBackground';
import { Title, Button } from '../components/UIComponents';
import { useTooltip } from '../contexts/TooltipContext';
import { scoreToGrade } from '../utils';
import { Save, FolderOpen, Close, Delete, Download, Upload } from '@mui/icons-material';
import { ScreenType } from './BaseScreen';
import { STATION_STAT_ICONS, StationStat } from '../Module';
import { buildSaveExport, tryDownloadTextAsFile, importSaveFromFile, copyTextToClipboard } from '../SaveFilePortability';

// Identifier stamped into exported save files (helps when players send saves for troubleshooting).
const STAGE_ID = 'spire-parc-fantasy-reskin';

interface SaveLoadScreenProps {
    stage: () => Stage;
    mode: 'save' | 'load';
    onClose: () => void;
    setScreenType?: (type: ScreenType) => void;
}

export const SaveLoadScreen: FC<SaveLoadScreenProps> = ({ stage, mode, onClose, setScreenType }) => {
    const { setTooltip, clearTooltip } = useTooltip();
    const [hoveredSlot, setHoveredSlot] = React.useState<number | null>(null);
    const [deleteConfirmSlot, setDeleteConfirmSlot] = React.useState<number | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    // When a real file download is blocked (e.g. sandboxed iframe), we show the save text here so the
    // player can copy it manually - guaranteeing they can always get their save out.
    const [exportFallbackText, setExportFallbackText] = React.useState<string | null>(null);

    // Export the current in-memory save. The stage runs in a sandboxed iframe that blocks direct file
    // downloads (and the block is silent - it can't be detected in JS), so we go straight to the copy
    // panel, which always works. The panel itself offers a download attempt for permissive environments.
    const handleExportToFile = () => {
        try {
            const { text } = buildSaveExport(
                { getSave: () => stage().getSave(), loadSaveObject: (s) => stage().loadSaveObject(s) },
                STAGE_ID
            );
            setExportFallbackText(text);
        } catch (err: any) {
            setTooltip(err?.message || 'Could not export save', Close, undefined, 3000);
        }
    };

    const handleTryDownload = () => {
        if (!exportFallbackText) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        tryDownloadTextAsFile(exportFallbackText, `${STAGE_ID}-save-${stamp}.json`);
        // We can't tell if the sandbox blocked it, so we don't claim success - the copy option remains.
    };

    const handleCopyFallback = async () => {
        if (!exportFallbackText) return;
        const ok = await copyTextToClipboard(exportFallbackText);
        setTooltip(ok ? 'Save copied to clipboard' : 'Select the text and copy it manually', ok ? Download : Close, undefined, 3000);
    };

    // Trigger the hidden file picker for import.
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    // Handle the chosen file: load it into the game, then go to the station.
    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Reset the input so selecting the same file again still fires onChange.
        e.target.value = '';
        if (!file) return;
        try {
            await importSaveFromFile({ getSave: () => stage().getSave(), loadSaveObject: (s) => stage().loadSaveObject(s) }, file);
            setTooltip('Save loaded from file', FolderOpen, undefined, 2500);
            onClose();
            if (setScreenType) {
                setScreenType(ScreenType.STATION);
            }
        } catch (err: any) {
            setTooltip(err?.message || 'Could not load that save file', Close, undefined, 3500);
        }
    };

    const handleSlotClick = (slotIndex: number) => {
        if (mode === 'save') {
            // Save to this slot
            stage().saveToSlot(slotIndex);
            setTooltip('Game saved!', Save, undefined, 2000);
            onClose();
        } else {
            // Load from this slot
            stage().loadSave(slotIndex);
            setTooltip('Game loaded!', FolderOpen, undefined, 2000);
            onClose();
            // Navigate to station screen
            if (setScreenType) {
                setScreenType(ScreenType.STATION);
            }
        }
    };

    const handleDelete = (slotIndex: number) => {
        stage().deleteSave(slotIndex);
        setDeleteConfirmSlot(null);
        setTooltip('Save deleted', Delete, undefined, 2000);
    };

    const formatTimestamp = (timestamp?: number): string => {
        if (!timestamp) return 'No Date';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const renderSaveSlot = (slotIndex: number) => {

        const save = stage().getAllSaves()[slotIndex];
        const isEmpty = !save;
        const isCurrentSlot = stage().getCurrentSlot() === slotIndex;

        // Get non-faction actors
        const actors = !isEmpty ? Object.values(save.actors).filter(actor => !actor.factionId && save.aide.actorId !== actor.id) : [];

        return (
            <motion.div
                key={slotIndex}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                    opacity: 1, 
                    x: hoveredSlot === slotIndex ? 5 : 0 
                }}
                transition={{ 
                    delay: slotIndex * 0.05,
                    x: { duration: 0.2 }
                }}
                style={{ width: '100%' }}
            >
                <Button
                    variant="menu"
                    onMouseEnter={() => {
                        setHoveredSlot(slotIndex);
                        setTooltip(
                            mode === 'save' 
                                ? `Save game to slot ${slotIndex + 1}` 
                                : isEmpty 
                                    ? 'Empty slot' 
                                    : `Load game from slot ${slotIndex + 1}`,
                            mode === 'save' ? Save : FolderOpen
                        );
                    }}
                    onMouseLeave={() => {
                        setHoveredSlot(null);
                        clearTooltip();
                    }}
                    onClick={() => handleSlotClick(slotIndex)}
                    disabled={mode === 'load' && isEmpty}
                    style={{
                        width: '100%',
                        height: '85px',
                        padding: '8px 12px',
                        paddingRight: isEmpty ? '12px' : '50px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                        background: isCurrentSlot 
                            ? 'rgba(176, 102, 255, 0.15)' 
                            : hoveredSlot === slotIndex && !(mode === 'load' && isEmpty)
                                ? 'rgba(176, 102, 255, 0.1)' 
                                : 'rgba(18, 8, 32, 0.5)',
                        border: isCurrentSlot ? '2px solid rgba(176, 102, 255, 0.5)' : undefined,
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Delete button for filled slots */}
                    {!isEmpty && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmSlot(slotIndex);
                            }}
                            onMouseEnter={(e) => {
                                e.stopPropagation();
                                setTooltip(isCurrentSlot ? 'Cannot delete current save' : 'Delete save', Delete);
                            }}
                            onMouseLeave={(e) => {
                                e.stopPropagation();
                                clearTooltip();
                            }}
                            disabled={isCurrentSlot}
                            style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: '40px',
                                background: isCurrentSlot ? 'rgba(100, 100, 100, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                                border: 'none',
                                borderLeft: isCurrentSlot ? '1px solid rgba(100, 100, 100, 0.4)' : '1px solid rgba(255, 0, 0, 0.4)',
                                borderRadius: '0 4px 4px 0',
                                color: isCurrentSlot ? 'rgba(150, 150, 150, 0.5)' : 'rgba(255, 100, 100, 0.9)',
                                cursor: isCurrentSlot ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                fontSize: '18px',
                                opacity: isCurrentSlot ? 0.5 : 1
                            }}
                            onMouseOver={(e) => {
                                if (!isCurrentSlot) {
                                    e.currentTarget.style.background = 'rgba(255, 0, 0, 0.3)';
                                    e.currentTarget.style.color = 'rgba(255, 150, 150, 1)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isCurrentSlot) {
                                    e.currentTarget.style.background = 'rgba(255, 0, 0, 0.2)';
                                    e.currentTarget.style.color = 'rgba(255, 100, 100, 0.9)';
                                }
                            }}
                        >
                            <Delete fontSize="small" />
                        </button>
                    )}

                    {isEmpty ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'rgba(176, 102, 255, 0.3)',
                            fontSize: '14px',
                            fontStyle: 'italic'
                        }}>
                            Empty Slot
                        </div>
                    ) : (
                        <>
                            {/* Actor portraits as background */}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                right: '40px',
                                display: 'flex',
                                height: '85px',
                                opacity: 0.3,
                                pointerEvents: 'none'
                            }}>
                                {actors.slice(0, 10).map((actor) => (
                                    <div
                                        key={actor.id}
                                        style={{
                                            width: '85px',
                                            height: '85px',
                                            overflow: 'hidden'
                                        }}
                                        title={actor.name}
                                    >
                                        <img
                                            src={actor.getEmotionImage(actor.getDefaultEmotion())}
                                            alt={actor.name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                objectPosition: 'top center'
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Single column layout */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '4px',
                                position: 'relative',
                                zIndex: 1
                            }}>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'rgba(176, 102, 255, 0.7)'
                                }}>
                                    {formatTimestamp(save.timestamp)}
                                </div>
                                <div style={{
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    color: 'rgba(176, 102, 255, 1)'
                                }}>
                                    {save.player.name} - Day {save.day}
                                </div>
                                {/* Station stats with icons */}
                                {save.stationStats && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '10px',
                                        alignItems: 'center'
                                    }}>
                                        {Object.values(StationStat).map((stat) => {
                                            const value = save.stationStats ? save.stationStats[stat] : 1;
                                            const Icon = STATION_STAT_ICONS[stat as keyof typeof STATION_STAT_ICONS];
                                            return (
                                                <div
                                                    key={stat}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '3px',
                                                        color: 'rgba(176, 102, 255, 0.8)'
                                                    }}
                                                    title={stat}
                                                >
                                                    {Icon && <Icon style={{ fontSize: '14px' }} />}
                                                    <span style={{ 
                                                        fontWeight: 'bold',
                                                        fontSize: '12px'
                                                    }}>
                                                        {scoreToGrade(value)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </motion.div>
        );
    };

    return (
        <div
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
                zIndex: 1000
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="glass-panel-bright"
                style={{
                    padding: '30px',
                    maxWidth: '800px',
                    width: '90%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                }}
            >
                {/* Header with close button */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                }}>
                    <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>
                        {mode === 'save' ? 'Save Game' : 'Load Game'}
                    </Title>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        onMouseEnter={() => setTooltip('Close', Close)}
                        onMouseLeave={() => clearTooltip()}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(176, 102, 255, 0.7)',
                            cursor: 'pointer',
                            fontSize: '24px',
                            padding: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Close />
                    </motion.button>
                </div>

                {/* Auto-save note for save mode */}
                {mode === 'save' && (
                    <div style={{
                        fontSize: '12px',
                        color: 'rgba(176, 102, 255, 0.6)',
                        fontStyle: 'italic',
                        marginBottom: '15px',
                        textAlign: 'left'
                    }}>
                        The game will continue to auto-save to your selected slot.
                    </div>
                )}

                {/* Save slots container */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    overflowY: 'auto',
                    paddingRight: '10px'
                }}>
                    {Array.from({ length: 10 }, (_, i) => renderSaveSlot(i))}
                </div>

                {/* File export/import: portable saves for backup, transfer, or sharing for troubleshooting. */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '15px',
                    paddingTop: '15px',
                    borderTop: '1px solid rgba(176, 102, 255, 0.2)',
                    flexWrap: 'wrap',
                }}>
                    <Button onClick={handleExportToFile}>
                        <Download style={{ fontSize: '18px', marginRight: '6px', verticalAlign: 'middle' }} />
                        Export Save to File
                    </Button>
                    <Button onClick={handleImportClick}>
                        <Upload style={{ fontSize: '18px', marginRight: '6px', verticalAlign: 'middle' }} />
                        Import Save from File
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        style={{ display: 'none' }}
                        onChange={handleImportFile}
                    />
                </div>
                <div style={{
                    fontSize: '11px',
                    color: 'rgba(176, 102, 255, 0.5)',
                    fontStyle: 'italic',
                    marginTop: '8px',
                    textAlign: 'left',
                    lineHeight: 1.4,
                }}>
                    Export shows your current game as text you can copy into a file to back up or send. Import loads a save file into the game (this replaces your current game).
                </div>
            </motion.div>

            {/* Export fallback modal: shown when a real file download is blocked by the environment. */}
            {exportFallbackText !== null && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1002,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setExportFallbackText(null); }}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="glass-panel-bright"
                        style={{ padding: '24px', maxWidth: '560px', width: '92%' }}
                    >
                        <div style={{ color: '#b066ff', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
                            Export Save
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(224,240,255,0.7)', marginBottom: '12px', lineHeight: 1.5 }}>
                            Copy the text below and paste it into a plain text file (name it something like
                            <em> my-save.json</em>) to back up or share your game. Load it later with the Import button.
                            You can also try a direct download, though this game runs in a sandbox that may block it.
                        </div>
                        <textarea
                            readOnly
                            value={exportFallbackText}
                            onFocus={(e) => e.target.select()}
                            style={{
                                width: '100%', height: '200px', padding: '10px', fontSize: '11px',
                                fontFamily: 'monospace', backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                border: '2px solid rgba(176, 102, 255, 0.3)', borderRadius: '5px',
                                color: '#e0f0ff', resize: 'vertical', boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button onClick={handleCopyFallback}>Copy to Clipboard</Button>
                            <Button variant="secondary" onClick={handleTryDownload}>Try Download</Button>
                            <Button variant="secondary" onClick={() => setExportFallbackText(null)}>Close</Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Delete confirmation modal */}
            {deleteConfirmSlot !== null && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setDeleteConfirmSlot(null);
                        }
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="glass-panel-bright"
                        style={{
                            padding: '30px',
                            maxWidth: '400px',
                            width: '90%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px'
                        }}
                    >
                        <Title variant="glow" style={{ textAlign: 'center', fontSize: '20px' }}>
                            Delete Save?
                        </Title>
                        <div style={{
                            color: 'rgba(176, 102, 255, 0.8)',
                            textAlign: 'center',
                            fontSize: '14px'
                        }}>
                            Are you sure you want to delete this save? This action cannot be undone.
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'center'
                        }}>
                            <Button
                                variant="menu"
                                onClick={() => setDeleteConfirmSlot(null)}
                                onMouseEnter={() => setTooltip('Cancel', Close)}
                                onMouseLeave={() => clearTooltip()}
                                style={{
                                    padding: '10px 20px',
                                    background: 'rgba(176, 102, 255, 0.1)'
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="menu"
                                onClick={() => handleDelete(deleteConfirmSlot)}
                                onMouseEnter={() => setTooltip('Confirm deletion', Delete)}
                                onMouseLeave={() => clearTooltip()}
                                style={{
                                    padding: '10px 20px',
                                    background: 'rgba(255, 0, 0, 0.2)',
                                    border: '2px solid rgba(255, 0, 0, 0.4)',
                                    color: 'rgba(255, 150, 150, 1)'
                                }}
                            >
                                Delete
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
};
