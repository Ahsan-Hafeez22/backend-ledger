import mongoose from "mongoose";
import bcrypt from 'bcrypt';

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
        required: [true, 'Password is required'],
        minLength: [8, 'Password must be at least 8 characters long'],
        select: false
    },

    // ────── Important Fields for Ledger App ──────

    phone: {
        type: String,
        trim: true,
        sparse: true,           // Allows multiple null values
        match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
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

    // Verification & Security
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
    }

}, {
    timestamps: true
});

// Password hashing middleware
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    // Avoid re-hashing already hashed password
    if (this.password.startsWith("$2b$")) return next();

    this.password = await bcrypt.hash(this.password, 12);   // 12 is better than 10
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;