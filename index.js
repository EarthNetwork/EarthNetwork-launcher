const remoteMain = require('@electron/remote/main')
remoteMain.initialize()

// Requirements
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const autoUpdater                   = require('electron-updater').autoUpdater
const ejse                          = require('ejs-electron')
const fs                            = require('fs')
const isDev                         = require('./app/assets/js/isdev')
const path                          = require('path')
const semver                        = require('semver')
const { pathToFileURL }             = require('url')
const redirectUriPrefix = 'https://login.microsoftonline.com/common/oauth2/nativeclient?'
const clientID = '7c4b0e47-d80a-4d85-a258-d4800c872b25'

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// Setup auto updater.  
function initAutoUpdater(event, data) {

    if(data){
        autoUpdater.allowPrerelease = true
    } else {
        // Defaults to true if application version contains prerelease components (e.g. 0.12.1-alpha.1)
        // autoUpdater.allowPrerelease = true
    }
    
    if(isDev){
        autoUpdater.autoInstallOnAppQuit = false
        autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    }
    if(process.platform === 'darwin'){
        autoUpdater.autoDownload = false
    }
    autoUpdater.on('update-available', (info) => {
        event.sender.send('autoUpdateNotification', 'update-available', info)
    })
    autoUpdater.on('update-downloaded', (info) => {
        event.sender.send('autoUpdateNotification', 'update-downloaded', info)
    })
    autoUpdater.on('update-not-available', (info) => {
        event.sender.send('autoUpdateNotification', 'update-not-available', info)
    })
    autoUpdater.on('checking-for-update', () => {
        event.sender.send('autoUpdateNotification', 'checking-for-update')
    })
    autoUpdater.on('error', (err) => {
        event.sender.send('autoUpdateNotification', 'realerror', err)
    }) 
}

// Open channel to listen for update actions.
ipcMain.on('autoUpdateAction', (event, arg, data) => {
    switch(arg){
        case 'initAutoUpdater':
            console.log('Initializing auto updater.')
            initAutoUpdater(event, data)
            event.sender.send('autoUpdateNotification', 'ready')
            break
        case 'checkForUpdate':
            autoUpdater.checkForUpdates()
                .catch(err => {
                    event.sender.send('autoUpdateNotification', 'realerror', err)
                })
            break
        case 'allowPrereleaseChange':
            if(!data){
                const preRelComp = semver.prerelease(app.getVersion())
                if(preRelComp != null && preRelComp.length > 0){
                    autoUpdater.allowPrerelease = true
                } else {
                    autoUpdater.allowPrerelease = data
                }
            } else {
                autoUpdater.allowPrerelease = data
            }
            break
        case 'installUpdateNow':
            autoUpdater.quitAndInstall()
            break
        default:
            console.log('Unknown argument', arg)
            break
    }
})
// Redirect distribution index event from preloader to renderer.
ipcMain.on('distributionIndexDone', (event, res) => {
    event.sender.send('distributionIndexDone', res)
})

// Disable hardware acceleration.
// https://electronjs.org/docs/tutorial/offscreen-rendering
app.disableHardwareAcceleration()

let MSALoginWindow = null
let login = false

// Open the Microsoft Account Login window
ipcMain.on('openMSALoginWindow', (ipcEvent, args) => {
    if (MSALoginWindow != null) {
        ipcEvent.reply('MSALoginWindowReply', 'error', 'AlreadyOpenException')
        return
    }
    MSALoginWindow = new BrowserWindow({
        title: 'Microsoft Login',
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('SealCircle')
    })
    this.MSALoginWindow = MSALoginWindow;

    MSALoginWindow.on('closed', () => {
        this.MSALoginWindow = null;
        MSALoginWindow = null
    })

    MSALoginWindow.on('close', event => {
        ipcEvent.reply('MSALoginWindowReply', 'error', 'AuthNotFinished')
    })

    MSALoginWindow.webContents.on('did-navigate', (event, uri, responseCode, statusText) => {
        // eslint-disable-next-line no-unused-vars
        login = true
        if (uri.startsWith(redirectUriPrefix)) {
            let querys = uri.substring(redirectUriPrefix.length).split('#', 1).toString().split('&')
            let queryMap = new Map()

            querys.forEach(query => {
                let arr = query.split('=')
                queryMap.set(arr[0], decodeURI(arr[1]))
            })

            ipcEvent.reply('MSALoginWindowReply', queryMap)

            MSALoginWindow.close()
            MSALoginWindow = null
        }
    })

    //MSALoginWindow.removeMenu()
    MSALoginWindow.loadURL('https://login.live.com/oauth20_authorize.srf?client_id='+ clientID + '&response_type=code&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient&scope=XboxLive.signin%20offline_access&prompt=select_account')
})

let MSALogoutWindow = null

ipcMain.on('openMSALogoutWindow', (ipcEvent, args) => {
    if (MSALogoutWindow == null) {
        MSALogoutWindow = new BrowserWindow({
            title: 'Microsoft Logout',
            backgroundColor: '#222222',
            width: 520,
            height: 600,
            frame: true,
            icon: getPlatformIcon('SealCircle')
        })
        MSALogoutWindow.loadURL('https://login.microsoftonline.com/common/oauth2/v2.0/logout')
        MSALogoutWindow.webContents.on('did-navigate', (e) => {
            setTimeout(() => {
                ipcEvent.reply('MSALogoutWindowReply')
            }, 5000)

        })
    }
})

// https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = true

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {

    win = new BrowserWindow({
        width: 980,
        minWidth: 980,
        height: 580,
        minHeight: 580,
        icon: getPlatformIcon('SealCircle'),
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'app', 'assets', 'js', 'preloader.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#171614'
    })
    remoteMain.enable(win.webContents)

    let MSALogoutWindow = null

ipcMain.on('openMSALogoutWindow', (ipcEvent, args) => {
    if (MSALogoutWindow == null) {
        MSALogoutWindow = new BrowserWindow({
            title: 'Microsoft Logout',
            backgroundColor: '#222222',
            width: 520,
            height: 600,
            frame: true,
            icon: getPlatformIcon('SealCircle')
        })
        MSALogoutWindow.loadURL('https://login.microsoftonline.com/common/oauth2/v2.0/logout')
        MSALogoutWindow.webContents.on('did-navigate', (e) => {
            setTimeout(() => {
                ipcEvent.reply('MSALogoutWindowReply')
            }, 5000)

        })
    }
})

    ejse.data('bkid', Math.floor((Math.random() * fs.readdirSync(path.join(__dirname, 'app', 'assets', 'images', 'backgrounds')).length)))

    win.loadURL(pathToFileURL(path.join(__dirname, 'app', 'app.ejs')).toString())

    /*win.once('ready-to-show', () => {
        win.show()
    })*/

    win.removeMenu()

    win.resizable = true

    win.on('closed', () => {
        if (MSALoginWindow || MSALogoutWindow) MSALoginWindow ? MSALoginWindow.close() : MSALogoutWindow.close();
        win = null
    })
}

function createMenu() {
    
    if(process.platform === 'darwin') {

        // Extend default included application menu to continue support for quit keyboard shortcut
        let applicationSubMenu = {
            label: 'RMTC Launcher',
            submenu: [{
                label: 'À propos',
                selector: 'orderFrontStandardAboutPanel:'
            }, {
                type: 'separator'
            }, {
                label: 'Quitter',
                accelerator: 'Command+Q',
                click: () => {
                    app.quit()
                }
            }]
        }

        // New edit menu adds support for text-editing keyboard shortcuts
        let editSubMenu = {
            label: 'Édition',
            submenu: [{
                label: 'Annuler',
                accelerator: 'CmdOrCtrl+Z',
                selector: 'undo:'
            }, {
                label: 'Répéter',
                accelerator: 'Shift+CmdOrCtrl+Z',
                selector: 'redo:'
            }, {
                type: 'separator'
            }, {
                label: 'Couper',
                accelerator: 'CmdOrCtrl+X',
                selector: 'cut:'
            }, {
                label: 'Copier',
                accelerator: 'CmdOrCtrl+C',
                selector: 'copy:'
            }, {
                label: 'Coller',
                accelerator: 'CmdOrCtrl+V',
                selector: 'paste:'
            }, {
                label: 'Tout sélectionner',
                accelerator: 'CmdOrCtrl+A',
                selector: 'selectAll:'
            }]
        }

        // Bundle submenus into a single template and build a menu object with it
        let menuTemplate = [applicationSubMenu, editSubMenu]
        let menuObject = Menu.buildFromTemplate(menuTemplate)

        // Assign it to the application
        Menu.setApplicationMenu(menuObject)

    }

}

function getPlatformIcon(filename){
    let ext
    switch(process.platform) {
        case 'win32':
            ext = 'ico'
            break
        case 'darwin':
        case 'linux':
        default:
            ext = 'png'
            break
    }

    return path.join(__dirname, 'app', 'assets', 'images', `${filename}.${ext}`)
}

app.on('ready', createWindow)
app.on('ready', createMenu)

app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})
