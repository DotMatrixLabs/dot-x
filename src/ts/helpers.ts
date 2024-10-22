import { createDir, copyFile, BaseDirectory, readBinaryFile, removeFile, exists, readDir } from '@tauri-apps/api/fs';
import {imageDimensionsFromData} from 'image-dimensions';
import { relaunch } from '@tauri-apps/api/process';

export async function copyFileToAppdata(filePath: string, folderName: string, fileName?: string) {
    if(!fileName) fileName = filePath.split("/").pop();
    // Create the `$APPDATA/folderName` directory
    await createDir(folderName, { dir: BaseDirectory.AppData, recursive: true });
    // Copy the file to the `$APPDATA/folderName` directory
    // If the file already exists, it will be overwritten
    await copyFile(filePath, `${folderName}/${fileName}`, { dir: BaseDirectory.AppData });
    // Return the path to the copied file
    return `${folderName}/${fileName}`;
}

export async function removeFileFromAppdata(filePaths: string | string[] ) {
    if(!Array.isArray(filePaths)) filePaths = [filePaths];
    // Delete the file from the `$APPDATA` directory
    // check if the file exists, if not return
    for (const path of filePaths) {
        const existsFile = await exists(path, { dir: BaseDirectory.AppData });
        if(!existsFile) continue;
        await removeFile(path, { dir: BaseDirectory.AppData });
    }
}

export async function getImage(filePath: string) {
    if(filePath === "" || !filePath) return;
    // Read the file as binary
    const imageFile = await readBinaryFile(filePath, { dir: BaseDirectory.AppData });
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
    const file = await readBinaryFile(filePath);
    const dimensions = imageDimensionsFromData(file);
    // Return the dimensions of the image
    return dimensions;
}


/**
 * Asynchronously removes all channel icons from the channelIcons directory in appdata.
 */
async function removeChannelIcons() {
    const dir = await readDir('channelIcons', { dir: BaseDirectory.AppData });
    if(dir.length === 0) return;
    for (const file of dir) {
        await removeFile(`channelIcons/${file.name}`, { dir: BaseDirectory.AppData });
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
            'config.js', 
            'extraApps.json'
        ]);
        await removeChannelIcons();
        await relaunch();
    } catch (error) {
        console.error('Error resetting all settings:', error);
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
        console.error('Error resetting channel settings:', error);
    }
}