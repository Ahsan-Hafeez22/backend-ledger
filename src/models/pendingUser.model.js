import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },

        data: {
            // Required fields
            name: { type: String, required: true },
            password: { type: String, required: true },  // already hashed
            phone: { type: String, required: true },
            // ✅ Optional fields — store them too if user submitted them
            dateOfBirth: { type: Date, default: null },
            country: { type: String, default: 'Pakistan' },
            defaultCurrency: { type: String, default: 'PKR' },
            role: { type: String, default: 'user' },
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },

        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// Auto-delete after expiresAt
pendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const pendingUserModel = mongoose.model('PendingUser', pendingUserSchema);
export default pendingUserModel;