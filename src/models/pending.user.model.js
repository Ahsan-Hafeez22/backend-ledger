import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },

        data: {
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