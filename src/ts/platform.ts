import { platform } from '@tauri-apps/plugin-os';

export type MarketplacePlatform = 'windows' | 'macos' | 'linux';

const PLATFORM_DISPLAY_NAMES: Record<MarketplacePlatform, string> = {
	windows: 'Windows',
	macos: 'macOS',
	linux: 'Linux',
};

const MARKETPLACE_PLATFORMS = new Set<MarketplacePlatform>(['windows', 'macos', 'linux']);

export function normalizePlatformValue(value: string): MarketplacePlatform | null {
	const normalized = value?.trim()?.toLowerCase() as MarketplacePlatform;
	return MARKETPLACE_PLATFORMS.has(normalized) ? normalized : null;
}

export async function getCurrentMarketplacePlatform(): Promise<MarketplacePlatform | null> {
	const osPlatform = await platform();
	return normalizePlatformValue(osPlatform);
}

export function getPlatformDisplayName(platformId: MarketplacePlatform): string {
	return PLATFORM_DISPLAY_NAMES[platformId] ?? platformId;
}

export function isPluginPlatformCompatible(
	pluginPlatforms: string[] | undefined | null,
	currentPlatform: MarketplacePlatform | null,
): boolean {
	if (!pluginPlatforms || pluginPlatforms.length === 0) {
		return true;
	}
	if (!currentPlatform) {
		return true;
	}
	return pluginPlatforms.some((entry) => normalizePlatformValue(entry) === currentPlatform);
}

export function getIncompatibleBadgeLabel(currentPlatform: MarketplacePlatform | null): string | null {
	if (!currentPlatform) {
		return null;
	}
	return `Not available on ${getPlatformDisplayName(currentPlatform)}`;
}