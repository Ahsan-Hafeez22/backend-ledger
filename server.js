import "dotenv/config";
import app from './src/app.js';
import connectDB from './src/config/db.js';
import { initializeFirebase } from './src/config/firebase.config.js';
import { createServer } from "http";
import { Server } from "socket.io";
import { initSocketHandler } from "./src/socket/socketHandler.js";
import { socketAuthMiddleware } from "./src/middlewares/socketMiddleware.js";

const port = process.env.PORT || 3000;

initializeFirebase();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
});

// Attach auth middleware then register handlers
io.use(socketAuthMiddleware);
initSocketHandler(io);



let server;
async function startServer() {
    console.log(port)
    await connectDB();
    server = httpServer.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer();

export { server }; 