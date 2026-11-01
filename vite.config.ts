import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
    if (mode === 'standalone') {
        // SPIRE Local: a standalone app for the player's own device, packaged for Android from local/
        // (relative paths so it also works from the app bundle; bundled art instead of Chub's public/ folder).
        return {
            plugins: [react()],
            base: './',
            publicDir: 'local/public',
            build: { outDir: 'local/www', emptyOutDir: true },
        }
    }
    if (mode != 'lib') {
        return {
            plugins: [react()]
        }
    } else {
        return { plugins: [
                react(),
                dts({
                    outDir: ['dist'],
                    include: ['src/**/*.ts*'],
                    staticImport: true,
                    rollupTypes: true,
                    insertTypesEntry: true,
                }),
            ],
            build: {
                lib: {
                    entry: resolve(__dirname, 'src/index.ts'),
                    name: 'index',
                    formats: ['umd', 'es', 'cjs', 'iife'],
                    fileName: 'index',
                },
                rollupOptions: {
                    external: ['react', 'react-dom'],
                    output: {
                        globals: {
                            react: 'React',
                            'react-dom': 'ReactDOM',
                        },
                    },
                }
            }
        }
    }
});