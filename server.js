import "dotenv/config";
import app from './src/app.js';
import connectDB from './src/config/db.js';
const port = process.env.PORT || 3000;

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