import mongoose from 'mongoose';

const refreshSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    isRevoked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// TTL Index - automatically delete after expiresAt
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshSchema);

export default RefreshToken;