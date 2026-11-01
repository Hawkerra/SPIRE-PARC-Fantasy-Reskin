import React, { FC, useRef, useState } from 'react';
import { UploadFile } from '@mui/icons-material';
import type { Stage } from '../Stage';
import { Button } from '../components/UIComponents';
import { summonCandidateFromCard } from './summon';
import { errorMessage } from './util';

type UploadStatus = { busy: boolean; text: string; error: boolean };

/**
 * The Summoning Sanctum's upload bar in SPIRE Local: choose (or drop) character card files, and each one
 * becomes a candidate in the reserve above, ready to drag into a summoning slot.
 */
export const CardUploadBar: FC<{ stage: () => Stage; reserveEmpty: boolean; onAdded: () => void }> = ({ stage, reserveEmpty, onAdded }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<UploadStatus>({ busy: false, text: '', error: false });
    const [dragOver, setDragOver] = useState(false);

    const summonFromFiles = async (files: File[]) => {
        if (files.length === 0 || status.busy) return;
        const problems: string[] = [];
        const added: string[] = [];
        for (const [index, file] of files.entries()) {
            setStatus({ busy: true, text: `Attuning to ${file.name}${files.length > 1 ? ` (${index + 1} of ${files.length})` : ''}... this takes a moment.`, error: false });
            try {
                const actor = await summonCandidateFromCard(file, stage());
                const save = stage().getSave();
                save.reserveActors = [...(save.reserveActors || []), actor];
                stage().saveGame();
                added.push(actor.name);
                onAdded();
            } catch (err) {
                console.error(`Card upload failed for ${file.name}:`, err);
                problems.push(errorMessage(err));
            }
        }
        const success = added.length ? `${added.join(', ')} ${added.length === 1 ? 'is' : 'are'} waiting in the reserve. Drag them into a summoning slot.` : '';
        setStatus({ busy: false, text: [success, ...problems].filter(Boolean).join(' '), error: problems.length > 0 });
    };

    return (
        <div
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
                if (e.dataTransfer.files.length === 0) return;
                e.preventDefault();
                setDragOver(false);
                void summonFromFiles(Array.from(e.dataTransfer.files));
            }}
            style={{
                margin: '8px auto 0', padding: '10px 14px', width: 'min(900px, calc(100% - 32px))', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                borderRadius: '10px', background: dragOver ? 'rgba(176, 102, 255, 0.22)' : 'rgba(18, 8, 32, 0.75)',
                border: `2px dashed ${dragOver ? 'rgba(176, 102, 255, 0.9)' : 'rgba(176, 102, 255, 0.4)'}`,
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".png,.json,image/png,application/json"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = ''; // Allow choosing the same file again later.
                    void summonFromFiles(files);
                }}
            />
            <Button variant="primary" disabled={status.busy} onClick={() => inputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                <UploadFile fontSize="small" />
                {status.busy ? 'Attuning...' : 'Upload character cards'}
            </Button>
            <span
                role="status"
                style={{ flex: '1 1 260px', fontSize: '13px', lineHeight: 1.45, color: status.error ? '#ffb3b3' : 'rgba(255, 255, 255, 0.8)' }}
            >
                {status.text || (reserveEmpty
                    ? 'Upload character cards (PNG or JSON, SillyTavern/Chub format) or drop them here to draw new souls toward the summoning circle.'
                    : 'Upload or drop more character cards to add them to the reserve.')}
            </span>
        </div>
    );
};
