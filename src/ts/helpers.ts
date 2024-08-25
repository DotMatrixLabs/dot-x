import { createDir, copyFile, BaseDirectory, readBinaryFile } from '@tauri-apps/api/fs';
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

export async function getImageFile(filePath: string) {
    // Read the file as binary
    const file = await readBinaryFile(filePath, { dir: BaseDirectory.AppData });
    // Return the binary file
    return file;
}

export async function getImageSize(filePath: string) {
    // Read the file as binary
    const file = await readBinaryFile(filePath);
    const dimensions = imageDimensionsFromData(file);
    // Return the dimensions of the image
    return dimensions;


}
    