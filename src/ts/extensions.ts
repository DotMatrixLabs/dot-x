import { Store } from "tauri-plugin-store-api";

class ExtensionStoreManager {
    private stores: Map<string, Store>;
    private stateStore: Store;
    private activeExtensions: Map<string, any>;

    constructor() {
        this.stores = new Map();
        this.stateStore = new Store("extension-states.json");
        this.activeExtensions = new Map();
    }

    private getStore(filename: string): Store {
        let store = this.stores.get(filename);
        if (!store) {
            store = new Store(filename);
            this.stores.set(filename, store);
        }
        return store;
    }

    // Settings management methods
    async set(filename: string, key: string, value: any) {
        const store = this.getStore(filename);
        await store.set(key, value);
        await store.save();
    }

    async get(filename: string, key: string): Promise<any> {
        const store = this.getStore(filename);
        return await store.get(key);
    }

    async delete(filename: string, key: string) {
        const store = this.getStore(filename);
        await store.delete(key);
        await store.save();
    }

    async has(filename: string, key: string): Promise<boolean> {
        const store = this.getStore(filename);
        return await store.has(key);
    }

    async save(filename: string) {
        const store = this.getStore(filename);
        await store.save();
    }

    async getAllValues(filename: string): Promise<Record<string, any>> {
        const store = this.getStore(filename);
        const entries = await store.entries();
        return Object.fromEntries(entries);
    }

    // Extension state management methods
    async enableExtension(extensionId: string) {
        await this.stateStore.set(extensionId, true);
        await this.stateStore.save();
    }

    async disableExtension(extensionId: string) {
        await this.stateStore.set(extensionId, false);
        await this.stateStore.save();
    }

    async isEnabled(extensionId: string): Promise<boolean> {
        const state = await this.stateStore.get(extensionId);
        return state === true;
    }

    async getAllStates(): Promise<Record<string, boolean>> {
        const entries = await this.stateStore.entries();
        const typedEntries = entries.map(([key, value]) => [key, Boolean(value)]);
        return Object.fromEntries(typedEntries);
    }

    async toggleExtension(extensionId: string): Promise<boolean> {
        const currentState = await this.isEnabled(extensionId);
        const newState = !currentState;
        await this.stateStore.set(extensionId, newState);
        await this.stateStore.save();
        await this.reloadExtension(extensionId);
        return newState;
    }

    async loadActiveExtensions() {
        const states = await this.getAllStates();
        
        // Clear existing active extensions
        this.activeExtensions.clear();

        // Load each enabled extension
        for (const [extensionId, isEnabled] of Object.entries(states)) {
            if (isEnabled) {
                try {
                    const extension = await import(`../extensions/${extensionId}/main.js`);
                    await extension.init();
                    this.activeExtensions.set(extensionId, extension);
                    console.log(`Loaded extension: ${extensionId}`);
                } catch (error) {
                    console.error(`Failed to load extension ${extensionId}:`, error);
                }
            }
        }
    }

    async reloadExtension(extensionId: string) {
        // Remove existing instance if it exists
        if (this.activeExtensions.has(extensionId)) {
            const extension = this.activeExtensions.get(extensionId);
            if (extension && extension.disconnect) {
                await extension.disconnect();
            }
            this.activeExtensions.delete(extensionId);
        }

        // If the extension should be enabled, load it
        const isEnabled = await this.isEnabled(extensionId);
        if (isEnabled) {
            try {
                const extension = await import(`../extensions/${extensionId}/main.js`);
                await extension.init();
                this.activeExtensions.set(extensionId, extension);
                console.log(`Reloaded extension: ${extensionId}`);
            } catch (error) {
                console.error(`Failed to reload extension ${extensionId}:`, error);
            }
        }
    }

    // Method to broadcast updates to all active extensions
    async broadcastToExtensions(method: string, ...args: any[]) {
        for (const [extensionId, extension] of this.activeExtensions.entries()) {
            if (extension && typeof extension[method] === 'function') {
                try {
                    await extension[method](...args);
                } catch (error) {
                    console.error(`Failed to call ${method} on extension ${extensionId}:`, error);
                }
            }
        }
    }
}

const extensionManager = new ExtensionStoreManager();

// Load active extensions on startup
extensionManager.loadActiveExtensions().catch(error => {
    console.error('Failed to load active extensions:', error);
});

export default extensionManager; 