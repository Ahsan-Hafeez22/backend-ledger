const app = require('./src/app');
const connectDB = require('./src/config/db');
require("dotenv").config();
const port = process.env.PORT || 3000;

let server;
async function startServer() {
    console.log(port)
    await connectDB();
    server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer();

module.exports = { server }; 