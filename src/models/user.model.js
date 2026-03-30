import mongoose from "mongoose";
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email address is required'],
        unique: [true, 'Email address already exists'],
        lowercase: true,
        match: [/.+@.+\..+/, 'Invalid email address']

    },
    name: {
        type: String,
        required: [true, 'Name is required'],
    },
    password: {
        type: String,
        required: [true, 'password is required'],
        minLength: [6, 'Password must be at least 6 characters long'],
        select: false,
    },
    systemUser: {
        type: Boolean,
        default: false,
        immtable: true,
        select: false,
    },
    verified: {
        type: Boolean,
        default: false
    }

},
    {
        timestamps: true
    },
);
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    if (this.password.startsWith("$2b$")) return;

    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
});
userSchema.methods.comparePassword = async function (password) {
    console.log(password, this.password);
    return await bcrypt.compare(password, this.password);
}

const userModel = mongoose.model('User', userSchema);
export default userModel;
