import { WebviewWindow } from '@tauri-apps/api/window'


class PillWidget {
    webview: any
    constructor() {
        this.webview = null;
    }


    createWindow() {
        this.webview = new WebviewWindow('pill',{
            title: "Pill Widget",
            url: "https://www.google.com",
            width: 400,
            height: 400,
            resizable: false,
            visible: true,
            transparent: true,
            maximized: false,
            fullscreen: false,
            decorations: false,
            alwaysOnTop: true,
        });
        this.webview.once('tauri://created', function () {
            // webview window successfully created
        })
        this.webview.once('tauri://error', function (e) {
            // an error occurred during webview window creation
        })
    }

    
}

export default new PillWidget();
