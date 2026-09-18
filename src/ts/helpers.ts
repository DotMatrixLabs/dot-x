import { mkdir, copyFile, BaseDirectory, readFile, remove, exists, readDir } from '@tauri-apps/plugin-fs';
import {imageDimensionsFromData} from 'image-dimensions';
import { relaunch } from '@tauri-apps/plugin-process';
import { open } from '@tauri-apps/plugin-shell';
import { createLogger } from './logger.ts';

const log = createLogger('helpers');

export async function copyFileToAppdata(filePath: string, folderName: string, fileName?: string) {
    if(!fileName) fileName = filePath.split("/").pop();
    // Create the `$APPDATA/folderName` directory
    await mkdir(folderName, { baseDir: BaseDirectory.AppData, recursive: true });
    // Copy the file to the `$APPDATA/folderName` directory
    // If the file already exists, it will be overwritten
    await copyFile(filePath, `${folderName}/${fileName}`, { toPathBaseDir: BaseDirectory.AppData });
    // Return the path to the copied file
    return `${folderName}/${fileName}`;
}

export async function removeFileFromAppdata(filePaths: string | string[] ) {
    if(!Array.isArray(filePaths)) filePaths = [filePaths];
    // Delete the file from the `$APPDATA` directory
    // check if the file exists, if not return
    for (const path of filePaths) {
        try {
            const existsFile = await exists(path, { baseDir: BaseDirectory.AppData });
            if(!existsFile) continue;
            await remove(path, { baseDir: BaseDirectory.AppData });
        } catch(error) {
            log.error(`Error removing file ${path}:`, error);
        }

    }
}

export async function getImage(filePath: string) {
    if(filePath === "" || !filePath) return;
    // Read the file as binary
    const imageFile = await readFile(filePath, { baseDir: BaseDirectory.AppData });
    // Convert the binary file to a base64 string
    const base64String = convertUint8ArrayToBase64(imageFile);
    // Return the base64 image
    
    // Return the binary file
    return `data:image/png;base64,${base64String}`;
}

function convertUint8ArrayToBase64(uint8Array: Uint8Array) {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return window.btoa(binary);
}

export async function getImageSize(filePath: string) {
    // Read the file as binary
    const file = await readFile(filePath);
    const dimensions = imageDimensionsFromData(file);
    // Return the dimensions of the image
    return dimensions;
}


/**
 * Asynchronously removes all channel icons from the channelIcons directory in appdata.
 */
async function removeChannelIcons() {
    try {
        const dir = await readDir('channelIcons', { baseDir: BaseDirectory.AppData });
        if(dir.length === 0) return;
        for (const file of dir) {
            try {
                await remove(`channelIcons/${file.name}`, { baseDir: BaseDirectory.AppData });
            } catch (error) {
                log.error(`Error removing file ${file.name}:`, error);
            }
        }
    } catch (error) {
        log.error('Error reading channelIcons directory:', error);
    }
}


/**
 * Asynchronously resets all application settings by removing specific configuration files from the appdata directory.
 * 
 * @async
 * @function
 * @throws Will log an error message to the console if any file removal operation fails.
 */
export async function resetAllSettings() {
    try {
        // remove all files from appdata
        await removeFileFromAppdata([
            'channelSettings.json', 
            'selectedApps.json', 
            'config.json', 
            'extraApps.json'
        ]);
        await removeChannelIcons();
        await relaunch();
    } catch (error) {
        log.error('Error resetting all settings:', error);
    }
}

/**
 * Asynchronously resets the channel settings by removing the relevant files from appdata.
 * 
 * This function attempts to remove 'channelSettings.json' and 'selectedApps.json' from the appdata directory.
 * If an error occurs during the file removal process, it logs the error to the console.
 * 
 * @async
 * @function
 * @throws Will log an error message to the console if the file removal fails.
 */
export async function resetChannelSettings() {
    try {
        // remove channelSettings and appsToControl from appdata
        await removeFileFromAppdata([
            'channelSettings.json', 
            'selectedApps.json'
        ]);
        await removeChannelIcons();
        await relaunch();
    } catch (error) {
        log.error('Error resetting channel settings:', error);
    }
}


export async function openLink(url: string): Promise<boolean> {
    try{
        await open(url);
        return true;
    } catch (error) {
        log.error('Error opening link:', error);
        return false;
    }
}

/**
 * Formats a date as a relative time string (e.g., "8 months ago", "2 days ago")
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(then.getTime())) {
        return 'Unknown';
    }
    
    const diffMs = now.getTime() - then.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSeconds < 60) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 30) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffMonths < 12) {
        return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    } else {
        return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
    }
}