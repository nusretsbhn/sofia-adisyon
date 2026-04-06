import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { config } from "./config.js";
import { setupSocket } from "./socket/events.js";
import { startSyncWorker } from "./sync/worker.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});
setupSocket(io);

httpServer.listen(config.port, () => {
  console.log(`TurAdisyon backend http://localhost:${config.port}`);
  console.log(`Admin (build sonrası) http://localhost:${config.port}/admin`);
  if (config.sync.enabled) {
    console.log(
      `[sync] rol=${config.sync.role} interval=${Math.round(config.sync.intervalMs / 60000)}dk`,
    );
  }
  startSyncWorker();
});
