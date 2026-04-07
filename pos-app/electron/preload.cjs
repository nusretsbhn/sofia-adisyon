const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("turadisyon", {
  version: "0.1.0",
  printReceipt: ({ printerName, text }) =>
    ipcRenderer.invoke("turadisyon:printReceipt", { printerName, text }),
});
