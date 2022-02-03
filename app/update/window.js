const { BrowserWindow } = require("electron");
const updater = require("electron-updater").autoUpdater;
const isDev = require('../assets/js/isdev')
const path = require('path')

class Updater {
	constructor() {
		/** @type {BrowserWindow} */
		this.win = null;
		this.updater = updater;
		this.updater.autoDownload = false;
		this.updater.channel = "latest";
		this.updater.allowDowngrade = false;
		this.updater.autoInstallOnAppQuit = true;
		if (isDev) {
			this.updater.autoInstallOnAppQuit = false
			this.updater.updateConfigPath = path.join(__dirname, '../../dev-app-update.yml')
		}


	}

	create() {
		this.win = new BrowserWindow({
			width: 500,
			height: 500,
			movable: false,
			resizable: false,
			webPreferences: {
				scrollBounce: true,
				contextIsolation: true,
				nodeIntegration: false,
				enableRemoteModule: false,
				preload: `${__dirname}/script.js`,
				devTools: false
			},
			frame: false,
			transparent: true,
			icon: `${__dirname}/../assets/images/SealCircle.png`
		});

		this.win.webContents.on("devtools-opened", () => {
			this.win.webContents.closeDevTools();
		});

		this.win.loadFile(`${__dirname}/updater.html`);
	}

	init() {
		return new Promise(async (resolve) => {
			const rsx = await this.updater.checkForUpdates().catch((e) => `ERREUR: ${e.message || e}`);
			if (typeof rsx === "string" && rsx.startsWith("ERREUR: ")) {
				this.win.webContents.send("error", rsx.replace("ERREUR: ", ""));
				return resolve(true);
			}

			this.updater.on("update-not-available", () => {
				resolve(true);
			});

			this.updater.on("update-downloaded", () => {
				this.win.setProgressBar(2);
				this.win.webContents.send("update-downloaded");
				this.updater.quitAndInstall();
				resolve(false);
			});

			this.updater.on("checking-for-update", () => {
				this.win.setProgressBar(2);
				this.win.webContents.send("checking-for-update");
			});

			this.updater.on("update-available", (info) => {
				this.win.webContents.send("new-update", info.version);
				this.updater.downloadUpdate();
			});

			this.updater.on("download-progress", (progress) => {
				const total = progress.total;
				const current = progress.transferred;

				this.win.webContents.send("download-progress", { total, current });
				let prg = current / total;
				if (prg < 0) prg = 0;
				if (prg > 1) prg = -1;
				this.win.setProgressBar(prg);
			});

			this.updater.on("error", (err) => {
				this.win.webContents.send("error", "Update Error!");
				resolve(true);
			});

			const rsy = await this.updater.checkForUpdates().catch((e) => `ERREUR: ${e.message || e}`);
			if (typeof rsy === "string" && rsy.startsWith("ERREUR: ")) {
				this.win.webContents.send("error", "Update Error!");
				return resolve(true);
			}
		});
	}

	close() {
		try {
			if (this.win) {
				this.win.destroy();
			}
		} catch { }
	}
}

module.exports = Updater;