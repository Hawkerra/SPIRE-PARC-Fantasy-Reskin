/**
 * Image helpers for SPIRE Local, which has no image-generation service: portraits come from uploaded card art
 * (downscaled, since they're stored inside saves) or from a generated placeholder.
 */

function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('That image could not be read.'));
        img.src = src;
    });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Scale an image down to fit within maxDim (never up) and re-encode it as WebP, falling back to PNG where
 * WebP encoding is unavailable. Returns a data URL. Re-encoding also strips any embedded card metadata.
 */
export async function downscaleImage(source: Blob, maxDim: number = 768, quality: number = 0.85): Promise<string> {
    const objectUrl = URL.createObjectURL(source);
    try {
        const img = await loadImageElement(objectUrl);
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Image processing is unavailable.');
        ctx.drawImage(img, 0, 0, width, height);
        const webp = canvas.toDataURL('image/webp', quality);
        return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function escapeXml(text: string): string {
    return text.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
}

/** Blend a #rrggbb color toward white by the given amount (0-1). */
function lighten(hex: string, amount: number): string {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return '#' + channels.map(c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('');
}

/** A portrait-shaped placeholder: a silhouette glowing in the character's theme color, with their initial. */
export function placeholderPortrait(name: string, color: string): string {
    const base = /^#[0-9a-f]{6}/i.test(color) ? color.slice(0, 7) : '#5b3a8c';
    const initial = escapeXml((name.trim()[0] || '?').toUpperCase());
    // Theme colors are chosen dark (for white text), so the center is lightened to keep the figure visible.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768">` +
        `<defs><radialGradient id="g" cx="50%" cy="34%" r="72%"><stop offset="0" stop-color="${lighten(base, 0.35)}"/>` +
        `<stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="#120820"/></radialGradient></defs>` +
        `<path d="M256 120c-70 0-118 58-118 138 0 52 22 96 58 120-92 22-156 92-176 190l-4 200h480l-4-200c-20-98-84-168-176-190 36-24 58-68 58-120 0-80-48-138-118-138z" fill="url(#g)" stroke="#b066ff" stroke-opacity="0.55" stroke-width="6"/>` +
        `<text x="256" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="150" fill="#ffffff" fill-opacity="0.85">${initial}</text>` +
        `</svg>`;
    // Base64, not URI-encoding: the game also uses portraits in unquoted CSS url(...), where the ")" of the
    // SVG's own url(#g) would cut the image off. (UTF-8 first, in case the initial isn't Latin-1.)
    const bytes = new TextEncoder().encode(svg);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return `data:image/svg+xml;base64,${btoa(binary)}`;
}
