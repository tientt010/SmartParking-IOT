import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 3000;

app.set("io", io);
app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: false }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", routes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "smartparking-pi-backend", uptime: process.uptime() })
);

import fs from "fs";
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
  console.log(`[Server] Frontend: ${FRONTEND_DIST}`);
} else {
  console.log(`[Server] ⚠️  Frontend dist not found at ${FRONTEND_DIST} — Chạy: cd frontend && npm run build`);
}

io.on("connection", (socket) => {
  console.log("[Socket] Client connected:", socket.id);
  socket.on("disconnect", () => console.log("[Socket] Client disconnected:", socket.id));
});

const startServer = async () => {
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] Dashboard: http://localhost:${PORT}`);
  });


};

startServer();
