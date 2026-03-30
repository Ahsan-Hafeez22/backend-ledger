import mongoose from 'mongoose';
import crypto from 'crypto';

const otpSchema = new mongoose.Schema(
    {
        otpHash: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['registration', 'forgot_password'],
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        isUsed: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Compound index for fast active-OTP lookups
otpSchema.index({ email: 1, type: 1, isUsed: 1, expiresAt: 1 });

// TTL index — MongoDB auto-deletes expired docs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static helper: hash a raw OTP consistently
otpSchema.statics.hashOtp = function (rawOtp) {
    return crypto.createHash('sha256').update(String(rawOtp)).digest('hex');
};

// Static helper: find active OTP for email
// type is optional — if not passed, finds any active OTP for that email
otpSchema.statics.findActive = function (email, type) {
    return this.findOne({
        email,
        ...(type && { type }),
        isUsed: false,
        expiresAt: { $gt: new Date() },
    });
};

const otpModel = mongoose.model('Otp', otpSchema);
export default otpModel;