import "dotenv/config";
import app from './src/app.js';
import connectDB from './src/config/db.js';
import { initializeFirebase } from './src/config/firebase.config.js';
const port = process.env.PORT || 3000;
initializeFirebase();
let server;
async function startServer() {
    console.log(port)
    await connectDB();
    server = app.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer();

export { server }; 