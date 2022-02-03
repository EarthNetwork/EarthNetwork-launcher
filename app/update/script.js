const ipcRenderer = require("electron").ipcRenderer;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("currentVersion").innerText = require(`${__dirname}/../../package.json`).version || "1.0.0";

    const state = document.getElementById("status");

    ipcRenderer.on("checking-for-update", (e) => {
        state.innerHTML = "Recherche de mises à jours...";
    });

    ipcRenderer.on("new-update", (e, version) => {
        state.innerHTML = `Mise à jour en cours <b>${version}</b>!`;
    });

    ipcRenderer.on("download-progress", (e, progress) => {
        let perc = Math.round((progress.current / progress.total) * 100) || 0;
        if (perc < 0) perc = 0;
        else if (perc > 100) perc = 100;

        state.innerHTML = `<b>Downloading Update (${perc}%)</b><br><progress max="100" value="${perc}"></progress>`;
    });

    ipcRenderer.on("update-downloaded", (e) => {
        state.innerHTML = "Finished downloading the update!";
    });

    ipcRenderer.on("error", (e, err) => {
        state.innerHTML = `Error Downloading Update: <b>${err}</b>!`;
    });
});