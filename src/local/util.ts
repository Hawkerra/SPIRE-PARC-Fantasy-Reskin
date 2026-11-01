/** A readable message from anything thrown. */
export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Read a property from untyped external data (card JSON, API responses), or undefined if it isn't an object. */
export function field(value: unknown, key: string): unknown {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

/** The value if it's a string, otherwise ''. */
export function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

/** The parts of Capacitor's global that SPIRE Local uses; only present inside the Android app. */
interface CapacitorGlobal {
    isNativePlatform?: () => boolean;
    Plugins?: {
        CapacitorHttp?: {
            request(options: Record<string, unknown>): Promise<{ status: number; data: unknown }>;
        };
        App?: {
            addListener(event: 'backButton', handler: () => void): Promise<{ remove(): void }>;
        };
    };
}

/** Capacitor's plugins when running as the Android app; undefined in a plain browser. */
export function capacitorPlugins(): CapacitorGlobal['Plugins'] | undefined {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    return cap?.isNativePlatform?.() ? cap.Plugins : undefined;
}
