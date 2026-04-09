import mongoose from "mongoose";
import bcrypt from 'bcrypt';


// src/models/User.js
const fcmTokenSchema = new mongoose.Schema(
    {
        token: { type: String, required: true },
        deviceId: { type: String, required: true },  // stable hardware/app ID
        deviceType: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
        deviceName: { type: String, default: 'unknown' }, // "Samsung S24", "iPhone 15"
        isActive: { type: Boolean, default: true },   // false = logged out / invalid token
        invalidAt: { type: Date, default: null },       // when FCM marked it invalid
        lastUsed: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },

        // Optional: notification preferences per device
        notificationsEnabled: { type: Boolean, default: true },
    },
    { _id: false }
);
const notificationPrefsSchema = new mongoose.Schema(
    {
        transactional: { type: Boolean, default: true },  // money sent/received
        marketing: { type: Boolean, default: true },  // promotions
        security: { type: Boolean, default: true },  // account frozen/suspended
    },
    { _id: false }
);
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },

    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/.+@.+\..+/, 'Please provide a valid email']
    },

    password: {
        type: String,
        select: false
    },

    fcmTokens: {
        type: [fcmTokenSchema],
        default: [],
        validate: {
            validator: (arr) => arr.length <= 10,
            message: 'Maximum 10 devices allowed per user.',
        },
    },

    notificationPrefs: {
        type: notificationPrefsSchema,
        default: () => ({}),
    },

    accountStatus: {
        type: String,
        enum: ['active', 'frozen', 'suspended', 'closed'],
        default: 'active',
    },
    // ────── Important Fields for Ledger App ──────

    phone: {
        type: String,
        trim: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number'],
        required: false
    },

    avatar: {
        type: String,           // URL of profile picture
        default: null
    },

    dateOfBirth: {
        type: Date
    },

    country: {
        type: String,
        default: 'Pakistan'
    },

    verified: {
        type: Boolean,
        default: false
    },

    emailVerifiedAt: {
        type: Date,
        default: null
    },

    isActive: {
        type: Boolean,
        default: true
    },

    // For Google Sign-In & Social Login
    googleId: {
        type: String,
        sparse: true,
        unique: true
    },

    authProvider: {
        type: String,
        enum: ['email', 'google'],
        default: 'email'
    },

    // Account & Ledger specific
    defaultCurrency: {
        type: String,
        default: 'PKR',
        enum: ['PKR', 'USD', 'EUR', 'GBP', 'INR']
    },

    // Role & Permissions (future-proof)
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },

    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    },

}, {
    timestamps: true
});
userSchema.index({ '_id': 1, 'fcmTokens.deviceId': 1 });
userSchema.index({ 'fcmTokens.token': 1 });

// Password hashing middleware
userSchema.pre("save", async function () {
    if (!this.password) return;
    if (!this.isModified("password")) return;
    if (this.password.startsWith("$2b$")) return;

    this.password = await bcrypt.hash(this.password, 12);
    // No next() needed here; the function simply finishes
});

userSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
    }
});
// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;