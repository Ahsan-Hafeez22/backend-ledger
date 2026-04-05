import mongoose from 'mongoose';

const resetPasswordSchema = new mongoose.Schema({
    tokenHash: {
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
    isUser: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});



// TTL Index - automatically delete after expiresAt
resetPasswordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ResetToken = mongoose.model('ResetPasswordToken', resetPasswordSchema);

export default ResetToken;