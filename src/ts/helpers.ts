import { createDir, copyFile, BaseDirectory, readBinaryFile, removeFile } from '@tauri-apps/api/fs';
import {imageDimensionsFromData} from 'image-dimensions';

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

export async function removeFileFromAppdata(filePath: string) {
    // Delete the file from the `$APPDATA` directory
    await removeFile(filePath, { dir: BaseDirectory.AppData });
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
    