import React, { FC, useState } from 'react';
import { motion } from 'framer-motion';
import { Close } from '@mui/icons-material';
import { GlassPanel, Title, Button, TextInput } from '../components/UIComponents';
import {
    CONNECTION_PRESETS, ConnectionPreset, LocalConnection, chatCompletion, isConnectionConfigured,
    isNativeApp, listModels, loadConnection, saveConnection,
} from './connection';
import { errorMessage } from './util';

const labelStyle: React.CSSProperties = {
    display: 'block', color: '#b066ff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px',
};
const noteStyle: React.CSSProperties = { color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px', lineHeight: 1.45, margin: '6px 0 0' };

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text: string };

/** SPIRE Local's AI connection settings: endpoint preset, key, model, and a connection test. */
export const ConnectionScreen: FC<{ onClose: () => void }> = ({ onClose }) => {
    const [connection, setConnection] = useState<LocalConnection>(() => loadConnection());
    const [firstRun] = useState(() => !isConnectionConfigured());
    const [models, setModels] = useState<string[]>([]);
    const [showKey, setShowKey] = useState(false);
    const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });

    const update = (patch: Partial<LocalConnection>) => {
        setConnection(prev => ({ ...prev, ...patch }));
        setStatus({ kind: 'idle', text: '' });
    };

    const choosePreset = (preset: ConnectionPreset) => {
        update({ preset, baseUrl: CONNECTION_PRESETS[preset].baseUrl, model: '' });
        setModels([]);
    };

    const cleaned = (): LocalConnection => ({
        ...connection, baseUrl: connection.baseUrl.trim(), apiKey: connection.apiKey.trim(), model: connection.model.trim(),
    });

    const fetchModels = async () => {
        setStatus({ kind: 'busy', text: 'Fetching models...' });
        try {
            const list = await listModels(cleaned());
            setModels(list);
            setStatus({ kind: 'ok', text: list.length ? `${list.length} models available; type or pick one under Model.` : 'The endpoint listed no models. Leave Model blank to use its default.' });
        } catch (err) {
            setStatus({ kind: 'error', text: errorMessage(err) });
        }
    };

    const testConnection = async () => {
        setStatus({ kind: 'busy', text: 'Testing...' });
        try {
            const reply = await chatCompletion(cleaned(), 'Reply with the single word: Ready', { maxTokens: 10 });
            setStatus({ kind: 'ok', text: `Connected. The model replied: "${reply.trim().slice(0, 80) || '(empty reply)'}"` });
        } catch (err) {
            setStatus({ kind: 'error', text: errorMessage(err) });
        }
    };

    const save = () => {
        saveConnection(cleaned());
        onClose();
    };

    const usable = isConnectionConfigured(cleaned());
    const isChub = connection.preset === 'chub-mars' || connection.preset === 'chub-mercury';
    const busy = status.kind === 'busy';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                position: 'fixed', inset: 0, zIndex: 3000, padding: '20px',
                background: 'rgba(0, 10, 20, 0.85)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <GlassPanel variant="bright" style={{ width: 'min(640px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>AI Connection</Title>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{ background: 'transparent', border: 'none', color: 'rgba(176, 102, 255, 0.7)', cursor: 'pointer', display: 'flex' }}
                    >
                        <Close />
                    </button>
                </div>
                <p style={{ ...noteStyle, marginBottom: '18px' }}>
                    {firstRun
                        ? 'Welcome to SPIRE Local. Everything the Spire writes comes from an AI model, so connect one before starting a game. '
                        : ''}
                    Your key is stored only on this device.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                        <label style={labelStyle}>Provider</label>
                        <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                            {(Object.keys(CONNECTION_PRESETS) as ConnectionPreset[]).map(preset => {
                                const selected = connection.preset === preset;
                                return (
                                    <motion.button
                                        key={preset}
                                        role="radio"
                                        aria-checked={selected}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => choosePreset(preset)}
                                        style={{
                                            padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                                            background: selected ? 'rgba(176, 102, 255, 0.15)' : 'rgba(18, 8, 32, 0.7)',
                                            border: selected ? '2px solid rgba(176, 102, 255, 0.5)' : '2px solid rgba(255, 255, 255, 0.1)',
                                            color: selected ? '#b066ff' : 'rgba(255, 255, 255, 0.8)',
                                        }}
                                    >
                                        {CONNECTION_PRESETS[preset].label}
                                    </motion.button>
                                );
                            })}
                        </div>
                        <p style={noteStyle}>{CONNECTION_PRESETS[connection.preset].hint}</p>
                        {isChub && !isNativeApp() && (
                            <p style={{ ...noteStyle, color: '#ffb366' }}>
                                You're running SPIRE in a web browser, and Chub's endpoints refuse requests from web pages. Use the Android app for Chub, or pick another provider.
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="connection-url" style={labelStyle}>Endpoint URL</label>
                        <TextInput
                            id="connection-url"
                            fullWidth
                            value={connection.baseUrl}
                            onChange={(e) => update({ baseUrl: e.target.value })}
                            placeholder="https://example.com/v1"
                            style={{ fontSize: '14px' }}
                        />
                    </div>

                    <div>
                        <label htmlFor="connection-key" style={labelStyle}>API Key{connection.preset === 'custom' ? ' (if your server needs one)' : ''}</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <TextInput
                                id="connection-key"
                                fullWidth
                                type={showKey ? 'text' : 'password'}
                                autoComplete="off"
                                value={connection.apiKey}
                                onChange={(e) => update({ apiKey: e.target.value })}
                                placeholder={isChub ? 'Your Chub API key' : 'API key'}
                                style={{ fontSize: '14px' }}
                            />
                            <Button variant="secondary" onClick={() => setShowKey(v => !v)} style={{ whiteSpace: 'nowrap' }}>
                                {showKey ? 'Hide' : 'Show'}
                            </Button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="connection-model" style={labelStyle}>Model</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <TextInput
                                id="connection-model"
                                fullWidth
                                list="connection-models"
                                value={connection.model}
                                onChange={(e) => update({ model: e.target.value })}
                                placeholder="Blank = the endpoint's default model"
                                style={{ fontSize: '14px' }}
                            />
                            <Button variant="secondary" onClick={fetchModels} disabled={busy || !connection.baseUrl.trim()} style={{ whiteSpace: 'nowrap' }}>
                                Fetch models
                            </Button>
                        </div>
                        <datalist id="connection-models">
                            {models.map(model => <option key={model} value={model} />)}
                        </datalist>
                    </div>

                    <div>
                        <label htmlFor="connection-temperature" style={labelStyle}>Temperature: {connection.temperature.toFixed(2)}</label>
                        <input
                            id="connection-temperature"
                            type="range"
                            min={0}
                            max={1.5}
                            step={0.05}
                            value={connection.temperature}
                            onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                            style={{ width: '100%', accentColor: '#b066ff' }}
                        />
                        <p style={noteStyle}>Lower is steadier, higher is more inventive. SPIRE also asks for strict formats, so very high values can cause garbled results.</p>
                    </div>

                    {status.text && (
                        <div
                            role="status"
                            style={{
                                padding: '10px 12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.45,
                                background: status.kind === 'error' ? 'rgba(255, 90, 90, 0.12)' : 'rgba(176, 102, 255, 0.1)',
                                border: `1px solid ${status.kind === 'error' ? 'rgba(255, 90, 90, 0.5)' : 'rgba(176, 102, 255, 0.35)'}`,
                                color: status.kind === 'error' ? '#ffb3b3' : 'rgba(255, 255, 255, 0.85)',
                            }}
                        >
                            {status.text}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={onClose}>{firstRun ? 'Later' : 'Cancel'}</Button>
                        <Button variant="secondary" onClick={testConnection} disabled={busy || !usable}>Test connection</Button>
                        <Button variant="primary" onClick={save} disabled={!usable}>Save</Button>
                    </div>
                </div>
            </GlassPanel>
        </motion.div>
    );
};
