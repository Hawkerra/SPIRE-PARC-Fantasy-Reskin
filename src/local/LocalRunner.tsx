import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CHARACTER, DEFAULT_INITIAL, DEFAULT_USER } from '@chub-ai/stages-ts';
import { Stage } from '../Stage';
import { localizeModuleTemplates } from './assets';
import { isConnectionConfigured } from './connection';
import { ConnectionScreen } from './ConnectionScreen';
import { OPEN_CONNECTION_EVENT } from './events';
import { loadChatState } from './persistence';
import { installLocalServices } from './services';
import { capacitorPlugins, errorMessage } from './util';

const centered: React.CSSProperties = {
    height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', boxSizing: 'border-box', textAlign: 'center',
    background: 'linear-gradient(45deg, #140a20 0%, #002244 100%)', color: '#d9b8ff', fontSize: '18px',
};

/**
 * Runs SPIRE on the player's own device, in place of Chub's stage runner: builds the stage from saves kept on
 * this device, swaps in local services (see services.ts), and asks for an AI connection on first launch.
 */
export const LocalRunner: FC = () => {
    const [stage, setStage] = useState<Stage | null>(null);
    const [error, setError] = useState('');
    const [showConnection, setShowConnection] = useState(() => !isConnectionConfigured());

    useEffect(() => {
        const open = () => setShowConnection(true);
        window.addEventListener(OPEN_CONNECTION_EVENT, open);
        return () => window.removeEventListener(OPEN_CONNECTION_EVENT, open);
    }, []);

    // In the Android app, the back button closes the AI Connection screen, or otherwise acts as Escape (the
    // game's own back/close key), instead of quitting the app in the middle of a game.
    const showConnectionRef = useRef(showConnection);
    showConnectionRef.current = showConnection;
    useEffect(() => {
        const appPlugin = capacitorPlugins()?.App;
        if (!appPlugin) return;
        const listener = appPlugin.addListener('backButton', () => {
            if (showConnectionRef.current) {
                setShowConnection(false);
            } else {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            }
        });
        return () => { void listener.then(handle => handle.remove()); };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            localizeModuleTemplates();
            const chatState = await loadChatState();
            const instance = new Stage({
                ...DEFAULT_INITIAL,
                users: { local: { ...DEFAULT_USER, anonymizedId: 'local', name: 'Magus' } },
                characters: { spire: { ...DEFAULT_CHARACTER, anonymizedId: 'spire', name: 'The Spire' } },
                config: {},
                chatState,
            } as ConstructorParameters<typeof Stage>[0]);
            installLocalServices(instance);
            await instance.load();
            if (!cancelled) setStage(instance);
        })().catch(err => {
            console.error('SPIRE Local failed to start:', err);
            if (!cancelled) setError(errorMessage(err));
        });
        return () => { cancelled = true; };
    }, []);

    // Render the game once; it manages its own screens and refreshes from here on.
    const game = useMemo(() => stage?.render(), [stage]);

    if (error) return <div style={centered}>The Spire couldn't start: {error}</div>;
    if (!game) return <div style={centered}>Opening the Spire...</div>;
    return (
        <>
            {game}
            {showConnection && <ConnectionScreen onClose={() => setShowConnection(false)} />}
        </>
    );
};
