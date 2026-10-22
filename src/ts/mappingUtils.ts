export function flattenMappedApps(allApps: Record<string, string[]>): string[] {
    return Object.values(allApps).flat();
}

export function excludeMappedApps(apps: string[], mappedApps: string[]): string[] {
    const normalizedMappings = new Set(mappedApps.map((app) => app.toLowerCase()));
    return apps.filter((app) => !normalizedMappings.has(app.toLowerCase()));
}
