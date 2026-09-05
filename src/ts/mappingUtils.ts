export function flattenMappedApps(allApps: Record<string, string[]>): string[] {
    return Object.values(allApps).flat();
}

export function excludeMappedApps(apps: string[], mappedApps: string[]): string[] {
    return apps.filter((app) => !mappedApps.includes(app));
}
