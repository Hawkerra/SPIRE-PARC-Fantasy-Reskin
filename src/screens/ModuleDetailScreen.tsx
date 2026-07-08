import React, { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Close, Save, Domain, Image as ImageIcon } from '@mui/icons-material';
import { Stage } from '../Stage';
import { ModuleIntrinsic, generateModuleImage, registerModule } from '../Module';
import { GlassPanel, Title, Button, TextInput } from '../components/UIComponents';

interface ModuleDetailScreenProps {
    moduleId: string;
    module: ModuleIntrinsic;
    stage: () => Stage;
    onClose: () => void;
}

export const ModuleDetailScreen: FC<ModuleDetailScreenProps> = ({ moduleId, module, stage, onClose }) => {
    const [editedModule, setEditedModule] = useState<{
        name: string;
        skitPrompt: string;
        imagePrompt: string;
        role: string;
        roleDescription: string;
        baseImageUrl: string;
        defaultImageUrl: string;
    }>({
        name: module.name || '',
        skitPrompt: module.skitPrompt || '',
        imagePrompt: module.imagePrompt || '',
        role: module.role || '',
        roleDescription: module.roleDescription || '',
        baseImageUrl: module.baseImageUrl || '',
        defaultImageUrl: module.defaultImageUrl || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [regeneratingImage, setRegeneratingImage] = useState(false);
    const [, forceUpdate] = useState({});
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ open: false, title: '', message: '' });

    const handleInputChange = (field: string, value: string) => {
        setEditedModule((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Live module instance (has grid position and linkedModuleIds), distinct from the intrinsic template.
    const liveModule = stage().getSave().layout.getModuleById(moduleId);
    const adjacentModules = liveModule ? stage().getSave().layout.getAdjacentModules(liveModule) : [];

    const isLinkedTo = (otherId: string): boolean => {
        return !!liveModule?.linkedModuleIds?.includes(otherId);
    };

    // Toggle a bidirectional link between this module and an adjacent one.
    const toggleLink = (otherId: string) => {
        const layout = stage().getSave().layout;
        const a = layout.getModuleById(moduleId);
        const b = layout.getModuleById(otherId);
        if (!a || !b) return;
        if (!a.linkedModuleIds) a.linkedModuleIds = [];
        if (!b.linkedModuleIds) b.linkedModuleIds = [];
        if (a.linkedModuleIds.includes(otherId)) {
            // Unlink both directions.
            a.linkedModuleIds = a.linkedModuleIds.filter(id => id !== otherId);
            b.linkedModuleIds = b.linkedModuleIds.filter(id => id !== moduleId);
        } else {
            a.linkedModuleIds.push(otherId);
            b.linkedModuleIds.push(moduleId);
        }
        stage().saveGame();
        forceUpdate({});
    };

    const moduleDisplayName = (m: typeof adjacentModules[number]): string => {
        return m.getAttribute('name') || m.type;
    };

    const handleSave = () => {
        const save = stage().getSave();
        const existing = save.customModules?.[moduleId];
        if (!existing) {
            stage().showPriorityMessage('Could not find this custom module in the active save.');
            return;
        }

        setIsSaving(true);

        const updatedModule: ModuleIntrinsic = {
            ...existing,
            name: editedModule.name,
            skitPrompt: editedModule.skitPrompt,
            imagePrompt: editedModule.imagePrompt,
            role: editedModule.role,
            roleDescription: editedModule.roleDescription,
            baseImageUrl: editedModule.baseImageUrl,
            defaultImageUrl: editedModule.defaultImageUrl,
        };

        save.customModules = {
            ...(save.customModules || {}),
            [moduleId]: updatedModule,
        };

        registerModule(moduleId, updatedModule);
        stage().saveGame();

        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 500);
    };

    const handleRegenerateModuleImage = () => {
        if (regeneratingImage) return;

        setConfirmDialog({
            open: true,
            title: 'Regenerate Module Image',
            message: 'This will regenerate the module image and replace the existing one. Continue?',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, open: false }));
                setRegeneratingImage(true);

                try {
                    const tempModule: ModuleIntrinsic = {
                        ...module,
                        ...editedModule,
                        cost: module.cost || {},
                    };
                    await generateModuleImage(tempModule, stage());

                    setEditedModule((prev) => ({
                        ...prev,
                        baseImageUrl: tempModule.baseImageUrl || prev.baseImageUrl,
                        defaultImageUrl: tempModule.defaultImageUrl || prev.defaultImageUrl,
                    }));
                    forceUpdate({});
                } catch (error) {
                    console.error('Failed to regenerate module image:', error);
                    stage().showPriorityMessage('Failed to regenerate module image. Check console for details.');
                } finally {
                    setRegeneratingImage(false);
                }
            },
        });
    };

    return (
        <>
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
                            maxWidth: '1200px',
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
                            <div
                                style={{
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
                                }}
                            >
                                <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>
                                    Module Details: {editedModule.name || moduleId}
                                </Title>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
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
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Close />
                                    </motion.button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                                <section>
                                    <h2
                                        style={{
                                            color: '#b066ff',
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            marginBottom: '15px',
                                            borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                            paddingBottom: '5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <Domain />
                                        Custom Module
                                    </h2>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                                                value={editedModule.name}
                                                onChange={(e) => handleInputChange('name', e.target.value)}
                                                placeholder="Module name"
                                            />
                                        </div>

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
                                                value={editedModule.skitPrompt}
                                                onChange={(e) => handleInputChange('skitPrompt', e.target.value)}
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
                                                value={editedModule.imagePrompt}
                                                onChange={(e) => handleInputChange('imagePrompt', e.target.value)}
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
                                                value={editedModule.role}
                                                onChange={(e) => handleInputChange('role', e.target.value)}
                                                placeholder="Role title"
                                            />
                                        </div>

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
                                                value={editedModule.roleDescription}
                                                onChange={(e) => handleInputChange('roleDescription', e.target.value)}
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

                                        {/* Linked Rooms: share narrative space with adjacent rooms so their owners appear together in scenes. */}
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(176, 102, 255, 0.9)', fontSize: '13px', fontWeight: 700 }}>
                                                Linked Rooms
                                            </label>
                                            <div style={{ fontSize: '12px', color: 'rgba(224, 240, 255, 0.55)', marginBottom: '10px', lineHeight: 1.4 }}>
                                                Link this room to an adjacent one so they share the same space. The owners of linked rooms appear together in each other's scenes - useful for a bar with both a bartender and an entertainer.
                                            </div>
                                            {adjacentModules.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'rgba(224, 240, 255, 0.4)', fontStyle: 'italic' }}>
                                                    No adjacent rooms to link. Build a room directly beside this one to link them.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {adjacentModules.map((adj) => {
                                                        const linked = isLinkedTo(adj.id);
                                                        return (
                                                            <div key={adj.id} style={{
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                padding: '8px 12px', borderRadius: '6px',
                                                                background: linked ? 'rgba(176, 102, 255, 0.14)' : 'rgba(18, 8, 32, 0.5)',
                                                                border: `1px solid ${linked ? 'rgba(176, 102, 255, 0.6)' : 'rgba(176, 102, 255, 0.2)'}`,
                                                            }}>
                                                                <span style={{ color: '#e0f0ff', fontSize: '13px', textTransform: 'capitalize' }}>{moduleDisplayName(adj)}</span>
                                                                <motion.button
                                                                    onClick={() => toggleLink(adj.id)}
                                                                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                                                    style={{
                                                                        padding: '4px 12px', borderRadius: '5px', cursor: 'pointer',
                                                                        fontSize: '12px', fontWeight: 700,
                                                                        background: linked ? 'rgba(248, 113, 113, 0.15)' : 'rgba(176, 102, 255, 0.2)',
                                                                        border: `1px solid ${linked ? 'rgba(248, 113, 113, 0.6)' : 'rgba(176, 102, 255, 0.5)'}`,
                                                                        color: linked ? '#f87171' : '#d9b8ff',
                                                                    }}
                                                                >
                                                                    {linked ? 'Unlink' : 'Link'}
                                                                </motion.button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

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
                                            {editedModule.defaultImageUrl && (
                                                <div
                                                    onClick={handleRegenerateModuleImage}
                                                    style={{
                                                        marginTop: '10px',
                                                        width: '100%',
                                                        height: '220px',
                                                        borderRadius: '5px',
                                                        backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                        border: '2px solid rgba(176, 102, 255, 0.3)',
                                                        backgroundImage: `url(${editedModule.defaultImageUrl})`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        cursor: regeneratingImage ? 'wait' : 'pointer',
                                                        opacity: regeneratingImage ? 0.6 : 1,
                                                        transition: 'opacity 0.2s ease',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    {regeneratingImage && (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '50%',
                                                                transform: 'translate(-50%, -50%)',
                                                                color: '#b066ff',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold',
                                                                textShadow: '0 0 10px rgba(0, 0, 0, 0.8)',
                                                            }}
                                                        >
                                                            Regenerating...
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!editedModule.defaultImageUrl && (
                                                <Button
                                                    variant="secondary"
                                                    onClick={handleRegenerateModuleImage}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        marginTop: '10px',
                                                    }}
                                                >
                                                    <ImageIcon style={{ fontSize: '18px' }} />
                                                    Generate Image
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h2
                                        style={{
                                            color: '#b066ff',
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            marginBottom: '15px',
                                            borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                            paddingBottom: '5px',
                                        }}
                                    >
                                        Additional Information
                                    </h2>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: '15px',
                                            backgroundColor: 'rgba(18, 8, 32, 0.4)',
                                            padding: '15px',
                                            borderRadius: '5px',
                                            border: '1px solid rgba(176, 102, 255, 0.2)',
                                        }}
                                    >
                                        <div>
                                            <div
                                                style={{
                                                    color: 'rgba(176, 102, 255, 0.7)',
                                                    fontSize: '12px',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                Module ID
                                            </div>
                                            <div style={{ color: '#e0f0ff', fontSize: '14px', fontFamily: 'monospace' }}>
                                                {moduleId}
                                            </div>
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    color: 'rgba(176, 102, 255, 0.7)',
                                                    fontSize: '12px',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                Base Image URL
                                            </div>
                                            <div
                                                style={{
                                                    color: '#e0f0ff',
                                                    fontSize: '12px',
                                                    wordBreak: 'break-all',
                                                    opacity: 0.9,
                                                }}
                                            >
                                                {editedModule.baseImageUrl || 'None'}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </GlassPanel>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                PaperProps={{
                    style: {
                        backgroundColor: 'rgba(18, 8, 32, 0.95)',
                        border: '2px solid rgba(176, 102, 255, 0.5)',
                        borderRadius: '8px',
                        color: '#e0f0ff',
                    },
                }}
            >
                <DialogTitle style={{ color: '#b066ff' }}>{confirmDialog.title}</DialogTitle>
                <DialogContent>
                    <p style={{ margin: 0, color: '#e0f0ff' }}>{confirmDialog.message}</p>
                </DialogContent>
                <DialogActions style={{ padding: '16px 24px' }}>
                    <Button
                        variant="secondary"
                        onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => confirmDialog.onConfirm?.()}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};