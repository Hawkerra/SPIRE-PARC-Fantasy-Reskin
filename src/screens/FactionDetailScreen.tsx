import React, { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Stage } from '../Stage';
import Faction, { generateFactionModuleImage } from '../factions/Faction';
import { GlassPanel, Title, Button, TextInput, Chip } from '../components/UIComponents';
import { Close, Save, Image as ImageIcon, Domain } from '@mui/icons-material';

interface FactionDetailScreenProps {
    faction: Faction;
    stage: () => Stage;
    onClose: () => void;
}

export const FactionDetailScreen: FC<FactionDetailScreenProps> = ({ faction, stage, onClose }) => {
    // Local state for editable fields
    const [editedFaction, setEditedFaction] = useState<{
        name: string;
        description: string;
        visualStyle: string;
        roles: string[];
        themeColor: string;
        themeFont: string;
        reputation: number;
        cutTies: boolean;
        backgroundImageUrl: string;
        // Module fields (if exists)
        moduleName: string;
        moduleSkitPrompt: string;
        moduleImagePrompt: string;
        moduleRole: string;
        moduleRoleDescription: string;
        moduleBaseImageUrl: string;
        moduleDefaultImageUrl: string;
    }>({
        name: faction.name,
        description: faction.description,
        visualStyle: faction.visualStyle,
        roles: [...faction.roles],
        themeColor: faction.themeColor,
        themeFont: faction.themeFont,
        reputation: faction.reputation,
        cutTies: (!faction.active && faction.reputation <= 0) || false,
        backgroundImageUrl: faction.backgroundImageUrl,
        // Module data
        moduleName: faction.module?.name || '',
        moduleSkitPrompt: faction.module?.skitPrompt || '',
        moduleImagePrompt: faction.module?.imagePrompt || '',
        moduleRole: faction.module?.role || '',
        moduleRoleDescription: faction.module?.roleDescription || '',
        moduleBaseImageUrl: faction.module?.baseImageUrl || '',
        moduleDefaultImageUrl: faction.module?.defaultImageUrl || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [newRole, setNewRole] = useState('');
    const [regeneratingImage, setRegeneratingImage] = useState(false);
    const [, forceUpdate] = useState({});
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ open: false, title: '', message: '' });

    const handleSave = () => {
        setIsSaving(true);
        
        // Update the faction in the save
        faction.name = editedFaction.name;
        faction.description = editedFaction.description;
        faction.visualStyle = editedFaction.visualStyle;
        faction.roles = [...editedFaction.roles];
        faction.themeColor = editedFaction.themeColor;
        faction.themeFont = editedFaction.themeFont;
        faction.reputation = editedFaction.reputation;
        if (!faction.active && faction.reputation <= 0 && !editedFaction.cutTies) {
            faction.reputation = 1;
            faction.active = true;
        } else if (faction.reputation > 0 && editedFaction.cutTies) {
            faction.reputation = 0;
            faction.active = false;
        }
        faction.backgroundImageUrl = editedFaction.backgroundImageUrl;

        // Update module if it exists
        if (faction.module) {
            faction.module.name = editedFaction.moduleName;
            faction.module.skitPrompt = editedFaction.moduleSkitPrompt;
            faction.module.imagePrompt = editedFaction.moduleImagePrompt;
            faction.module.role = editedFaction.moduleRole;
            faction.module.roleDescription = editedFaction.moduleRoleDescription;
            faction.module.baseImageUrl = editedFaction.moduleBaseImageUrl;
            faction.module.defaultImageUrl = editedFaction.moduleDefaultImageUrl;
        }

        // Save the game
        stage().saveGame();
        
        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 500);
    };

    const handleInputChange = (field: string, value: string | number | boolean) => {
        setEditedFaction(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddRole = () => {
        if (newRole.trim() && !editedFaction.roles.includes(newRole.trim())) {
            setEditedFaction(prev => ({
                ...prev,
                roles: [...prev.roles, newRole.trim()]
            }));
            setNewRole('');
        }
    };

    const handleRemoveRole = (roleToRemove: string) => {
        setEditedFaction(prev => ({
            ...prev,
            roles: prev.roles.filter(role => role !== roleToRemove)
        }));
    };

    const handleRegenerateModuleImage = async () => {
        if (!faction.module || regeneratingImage) return;
        
        setConfirmDialog({
            open: true,
            title: 'Regenerate Module Image',
            message: 'This will regenerate the module image and replace the existing one. Continue?',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setRegeneratingImage(true);
                
                try {
                    await generateFactionModuleImage(faction, faction.module!, stage());
                    // Update local state with new image URLs
                    setEditedFaction(prev => ({
                        ...prev,
                        moduleDefaultImageUrl: faction.module!.defaultImageUrl,
                        moduleBaseImageUrl: faction.module!.baseImageUrl
                    }));
                    // Force a re-render to show the new image
                    forceUpdate({});
                } catch (error) {
                    console.error('Failed to regenerate module image:', error);
                    stage().showPriorityMessage('Failed to regenerate module image. Check console for details.');
                } finally {
                    setRegeneratingImage(false);
                }
            }
        });
    };

    const representative = faction.representativeId 
        ? stage().getSave().actors[faction.representativeId]
        : null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 10, 20, 0.9)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100,
                    padding: '20px',
                }}
                onClick={(e) => {
                    // Don't close if user is selecting text
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;
                    
                    if (e.target === e.currentTarget && !hasSelection) {
                        onClose();
                    }
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '90vw',
                        maxWidth: '1400px',
                        maxHeight: '90vh',
                    }}
                >
                    <GlassPanel 
                        variant="bright"
                        style={{
                            height: '90vh',
                            overflow: 'auto',
                            position: 'relative',
                            padding: '30px',
                        }}
                    >
                        {/* Header with close button */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '20px',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(18, 8, 32, 0.95)',
                            backdropFilter: 'blur(8px)',
                            padding: '10px 0',
                            zIndex: 10,
                        }}>
                            <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>
                                Faction Details: {faction.name}
                            </Title>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Save style={{ fontSize: '20px' }} />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
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
                        </div>

                        {/* Form Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            
                            {/* Basic Info Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Basic Information
                                </h2>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {/* Name */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Name
                                        </label>
                                        <TextInput
                                            fullWidth
                                            value={editedFaction.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="Faction name"
                                        />
                                    </div>

                                    {/* cut-ties toggle */}
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Active
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="checkbox"
                                                checked={!editedFaction.cutTies}
                                                onChange={(e) => handleInputChange('cutTies', !e.target.checked)}
                                                id="faction-cutTies-toggle"
                                            />
                                            <label htmlFor="faction-cutTies-toggle" style={{ color: '#e0f0ff', fontSize: '14px' }}>
                                                {!editedFaction.cutTies ? 'Active' : 'Deactivated'}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Description
                                        </label>
                                        <textarea
                                            value={editedFaction.description}
                                            onChange={(e) => handleInputChange('description', e.target.value)}
                                            placeholder="Faction's purpose, values, and role in the galaxy"
                                            style={{
                                                width: '100%',
                                                minHeight: '100px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>

                                    {/* Visual Style */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Visual Style & Aesthetic
                                        </label>
                                        <textarea
                                            value={editedFaction.visualStyle}
                                            onChange={(e) => handleInputChange('visualStyle', e.target.value)}
                                            placeholder="Architectural style, uniforms, colors, and overall visual identity"
                                            style={{
                                                width: '100%',
                                                minHeight: '80px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Theme Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Theme
                                </h2>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    {/* Theme Color */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Theme Color
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <TextInput
                                                value={editedFaction.themeColor}
                                                onChange={(e) => handleInputChange('themeColor', e.target.value)}
                                                placeholder="#RRGGBB"
                                                style={{ flex: 1 }}
                                            />
                                            <div
                                                style={{
                                                    width: '50px',
                                                    height: '38px',
                                                    backgroundColor: editedFaction.themeColor,
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Font Family */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Font Family
                                        </label>
                                        <TextInput
                                            fullWidth
                                            value={editedFaction.themeFont}
                                            onChange={(e) => handleInputChange('themeFont', e.target.value)}
                                            placeholder="Font stack (e.g., Georgia, serif)"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Background Image Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <ImageIcon />
                                    Background Image
                                </h2>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {editedFaction.backgroundImageUrl && (
                                        <div
                                            style={{
                                                width: '100%',
                                                height: '200px',
                                                borderRadius: '8px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                backgroundImage: `url(${editedFaction.backgroundImageUrl})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                            }}
                                        />
                                    )}
                                </div>
                            </section>

                            {/* Custom Module Section */}
                            {faction.module && (
                                <section>
                                    <h2 style={{ 
                                        color: '#b066ff', 
                                        fontSize: '18px', 
                                        fontWeight: 'bold',
                                        marginBottom: '15px',
                                        borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                        paddingBottom: '5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <Domain />
                                        Custom Module
                                    </h2>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {/* Module Name */}
                                        <div>
                                            <label 
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Module Name
                                            </label>
                                            <TextInput
                                                fullWidth
                                                value={editedFaction.moduleName}
                                                onChange={(e) => handleInputChange('moduleName', e.target.value)}
                                                placeholder="Module name"
                                            />
                                        </div>

                                        {/* Skit Prompt */}
                                        <div>
                                            <label 
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Skit/Purpose Prompt
                                            </label>
                                            <textarea
                                                value={editedFaction.moduleSkitPrompt}
                                                onChange={(e) => handleInputChange('moduleSkitPrompt', e.target.value)}
                                                placeholder="Room's function and role in the tower"
                                                style={{
                                                    width: '100%',
                                                    minHeight: '80px',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    color: '#e0f0ff',
                                                    fontFamily: 'inherit',
                                                    resize: 'vertical',
                                                }}
                                            />
                                        </div>

                                        {/* Image Prompt */}
                                        <div>
                                            <label 
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Visual Description
                                            </label>
                                            <textarea
                                                value={editedFaction.moduleImagePrompt}
                                                onChange={(e) => handleInputChange('moduleImagePrompt', e.target.value)}
                                                placeholder="Visual description for image generation"
                                                style={{
                                                    width: '100%',
                                                    minHeight: '60px',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    color: '#e0f0ff',
                                                    fontFamily: 'inherit',
                                                    resize: 'vertical',
                                                }}
                                            />
                                        </div>

                                        {/* Role Name */}
                                        <div>
                                            <label 
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Role Name
                                            </label>
                                            <TextInput
                                                fullWidth
                                                value={editedFaction.moduleRole}
                                                onChange={(e) => handleInputChange('moduleRole', e.target.value)}
                                                placeholder="Role title"
                                            />
                                        </div>

                                        {/* Role Description */}
                                        <div>
                                            <label 
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Role Description
                                            </label>
                                            <textarea
                                                value={editedFaction.moduleRoleDescription}
                                                onChange={(e) => handleInputChange('moduleRoleDescription', e.target.value)}
                                                placeholder="Responsibilities and duties"
                                                style={{
                                                    width: '100%',
                                                    minHeight: '60px',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    color: '#e0f0ff',
                                                    fontFamily: 'inherit',
                                                    resize: 'vertical',
                                                }}
                                            />
                                        </div>

                                        {/* Module Image */}
                                        <div>
                                            <label 
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Default Image
                                            </label>
                                            {editedFaction.moduleDefaultImageUrl && (
                                                <div
                                                    onClick={handleRegenerateModuleImage}
                                                    style={{
                                                        marginTop: '10px',
                                                        width: '100%',
                                                        height: '200px',
                                                        borderRadius: '5px',
                                                        backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                        border: '2px solid rgba(176, 102, 255, 0.3)',
                                                        backgroundImage: `url(${editedFaction.moduleDefaultImageUrl})`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        cursor: regeneratingImage ? 'wait' : 'pointer',
                                                        opacity: regeneratingImage ? 0.6 : 1,
                                                        transition: 'opacity 0.2s ease',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    {regeneratingImage && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: '#b066ff',
                                                            fontSize: '14px',
                                                            fontWeight: 'bold',
                                                            textShadow: '0 0 10px rgba(0, 0, 0, 0.8)',
                                                        }}>
                                                            Regenerating...
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Read-only Info Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Additional Information
                                </h2>
                                
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                    gap: '15px',
                                    backgroundColor: 'rgba(18, 8, 32, 0.4)',
                                    padding: '15px',
                                    borderRadius: '5px',
                                    border: '1px solid rgba(176, 102, 255, 0.2)',
                                }}>
                                    <div>
                                        <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                            Faction ID
                                        </div>
                                        <div style={{ color: '#e0f0ff', fontSize: '14px', fontFamily: 'monospace' }}>
                                            {faction.id}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                            Reputation
                                        </div>
                                        <div style={{ color: '#e0f0ff', fontSize: '14px' }}>
                                            {faction.reputation}/10 - {faction.getReputationDescription()}
                                        </div>
                                    </div>
                                    {representative && (
                                        <div>
                                            <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                                Representative
                                            </div>
                                            <div style={{ color: '#e0f0ff', fontSize: '14px' }}>
                                                {representative.name}
                                            </div>
                                        </div>
                                    )}
                                    {faction.fullPath && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                                Source Path
                                            </div>
                                            <div style={{ 
                                                color: '#e0f0ff', 
                                                fontSize: '12px', 
                                                fontFamily: 'monospace',
                                                wordBreak: 'break-all'
                                            }}>
                                                {faction.fullPath}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>
                    </GlassPanel>
                </motion.div>
            </motion.div>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                PaperProps={{
                    style: {
                        backgroundColor: 'rgba(18, 8, 32, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '2px solid rgba(176, 102, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#e0f0ff',
                        minWidth: '400px',
                    }
                }}
            >
                <DialogTitle style={{
                    color: '#b066ff',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                    paddingBottom: '10px',
                }}>
                    {confirmDialog.title}
                </DialogTitle>
                <DialogContent style={{ paddingTop: '20px' }}>
                    <div style={{
                        color: '#e0f0ff',
                        fontSize: '14px',
                        lineHeight: '1.6',
                    }}>
                        {confirmDialog.message}
                    </div>
                </DialogContent>
                <DialogActions style={{ padding: '15px 20px', display: 'flex', gap: '10px' }}>
                    <Button
                        onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDialog.onConfirm}
                        variant="primary"
                    >
                        Regenerate
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatePresence>
    );
};
