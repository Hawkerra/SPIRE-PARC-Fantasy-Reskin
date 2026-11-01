import { IS_LOCAL } from './env';
import { MODULE_TEMPLATES } from '../Module';

/**
 * The Chub build loads its art from Chub's media server. The local build ships downscaled copies instead
 * (local/public/local-art), so it keeps working wherever Chub is unreachable.
 */
const LOCAL_ART: Record<string, string> = {
    'https://media.charhub.io/66449ff3-1a40-4e41-a008-d541ae05bcec/112975ea-7924-4ddc-9a9f-63779c4bec7d.png': './local-art/112975ea.webp',
    'https://media.charhub.io/9af4597d-a1bd-4f6e-9680-33de1b230333/00b3e479-5ad4-4225-b35d-ed1b15c2d2ff.png': './local-art/00b3e479.webp',
    'https://media.charhub.io/9c7272aa-b468-4a04-8013-c643149cea29/5de9e404-a651-4b21-bc2a-7050c43dc995.png': './local-art/5de9e404.webp',
    'https://media.charhub.io/a4a6c1ed-866d-439b-a9c0-1a00897187b9/ba47369e-b666-4a31-9745-54f9ccf294fb.png': './local-art/ba47369e.webp',
    'https://media.charhub.io/a543e339-136b-4c51-8c64-02f467d8316b/ce0ebe1d-8b03-4734-8a71-5d1873b181a4.png': './local-art/ce0ebe1d.webp',
    'https://media.charhub.io/b2bdaa4d-1d35-4640-aceb-811adecd6390/d2721c48-ae91-4c6b-840e-5fd744b05ffb.png': './local-art/d2721c48.webp',
    'https://media.charhub.io/b978c4d3-d24a-44f4-a75b-e4f5d3bcd0b2/d01a6221-b46e-4d47-9e32-d99406582acc.png': './local-art/d01a6221.webp',
    'https://media.charhub.io/c752b842-b465-451c-b870-3d2d612e51c0/f8ee79f3-d243-4a5e-be01-78a6412e132c.png': './local-art/f8ee79f3.webp',
    'https://media.charhub.io/cb482b96-fa2e-44cf-83ea-b90fb7d53467/c4c2851e-a111-4ffa-9cab-ba039738c88d.png': './local-art/c4c2851e.webp',
    'https://media.charhub.io/d081e188-8bd0-4027-9e21-489840924a95/968a7272-75f1-4b3d-b516-64588d9b0f03.png': './local-art/968a7272.webp',
    'https://media.charhub.io/dab03719-bf9b-42ad-b66a-3427c478000d/416b208c-14de-4e17-900c-221b8f9ee271.png': './local-art/416b208c.webp',
    'https://media.charhub.io/f245fce6-778c-453c-9594-ec1ccad5aa34/a2c796c9-d379-4d63-b001-0af5fe4054f6.png': './local-art/a2c796c9.webp',
};

/** In the local build, swap a Chub-hosted art URL for its bundled copy; anywhere else, return it unchanged. */
export function localAsset(url: string): string {
    return (IS_LOCAL && LOCAL_ART[url]) || url;
}

/** Point the built-in room templates at the bundled art. Run once at local startup, before any save loads. */
export function localizeModuleTemplates(): void {
    for (const template of Object.values(MODULE_TEMPLATES)) {
        if (template.baseImageUrl) template.baseImageUrl = localAsset(template.baseImageUrl);
        if (template.defaultImageUrl) template.defaultImageUrl = localAsset(template.defaultImageUrl);
    }
}
