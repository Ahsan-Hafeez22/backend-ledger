import mongoose from 'mongoose';
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI).then(() => {
            console.log('Database connected');
        }).catch(err => {
            console.log("Database connection Failed", err);
            process.exit(1);
        });
    } catch (error) {
        console.log(error);
    }
}

export default connectDB;
