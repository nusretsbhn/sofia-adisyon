const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("turadisyon", {
  version: "0.1.0",
});
