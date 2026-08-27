/**
 * Channel target entries are the apps, devices, and system features selected
 * for a Dot X channel.
 *
 * @category Channel Targets
 */
export type ChannelTarget = string;

/**
 * Channel target entries keyed by channel ID.
 *
 * @category Channel Targets
 */
export type ChannelTargetsByChannel = Record<string, ChannelTarget[]>;

/**
 * Response returned when reading one channel's targets.
 *
 * @category Channel Targets
 */
export interface ChannelTargetsForChannelResponse {
  /** Channel ID as stored by Dot X. */
  channel: string;
  /** Apps, devices, and system features selected for the channel. */
  targets: ChannelTarget[];
}

/**
 * Response returned when reading every stored channel's targets.
 *
 * @category Channel Targets
 */
export interface ChannelTargetsAllResponse {
  /** Selected targets keyed by channel ID. */
  channels: ChannelTargetsByChannel;
}

/**
 * Reads the apps, devices, and system features selected for Dot X channels.
 *
 * Access this API via `this.channelTargets` in your plugin class.
 *
 * @category Channel Targets
 * @displayName this.channelTargets (ChannelTargetsAPI)
 * @order first
 *
 * @example
 * ```typescript
 * export default class MyPlugin extends Plugin {
 *   async onLoad() {
 *     const channelZero = await this.channelTargets.getForChannel(0);
 *     console.log('Channel 0 targets:', channelZero.targets);
 *
 *     const allChannels = await this.channelTargets.getAll();
 *     console.log('All channel targets:', allChannels.channels);
 *   }
 * }
 * ```
 */
export class ChannelTargetsAPI {
  private apiCallFn: (method: string, params: any) => Promise<any>;

  constructor(apiCallFn: (method: string, params: any) => Promise<any>) {
    this.apiCallFn = apiCallFn;
  }

  /**
   * Gets the apps, devices, and system features selected for one channel.
   *
   * Unassigned channels return an empty `targets` array.
   *
   * @param channel - Channel ID to read.
   * @returns Promise that resolves to the channel ID and selected targets.
   *
   * @category Channel Targets
   * @displayName getForChannel
   *
   * @example
   * ```typescript
   * const { channel, targets } = await this.channelTargets.getForChannel(0);
   * console.log(`Channel ${channel}:`, targets);
   * ```
   */
  async getForChannel(channel: number | string): Promise<ChannelTargetsForChannelResponse> {
    const result = await this.apiCallFn('channelTargets.getForChannel', { channel });
    return {
      channel: String(result?.channel ?? channel),
      targets: Array.isArray(result?.targets) ? result.targets : [],
    };
  }

  /**
   * Gets the apps, devices, and system features selected for every stored channel.
   *
   * @returns Promise that resolves to all stored channel targets keyed by channel ID.
   *
   * @category Channel Targets
   * @displayName getAll
   *
   * @example
   * ```typescript
   * const { channels } = await this.channelTargets.getAll();
   * for (const [channel, targets] of Object.entries(channels)) {
   *   console.log(channel, targets);
   * }
   * ```
   */
  async getAll(): Promise<ChannelTargetsAllResponse> {
    const result = await this.apiCallFn('channelTargets.getAll', {});
    const channels = result?.channels && typeof result.channels === 'object'
      ? result.channels as ChannelTargetsByChannel
      : {};

    return { channels };
  }
}

/**
 * Factory function to create a new ChannelTargetsAPI instance.
 *
 * @internal
 * @category Channel Targets
 */
export function createChannelTargetsAPI(apiCallFn: (method: string, params: any) => Promise<any>): ChannelTargetsAPI {
  return new ChannelTargetsAPI(apiCallFn);
}
