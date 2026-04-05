import mongoose from "mongoose";
import ledgerModel from "./ledger.model.js";
import { customAlphabet } from "nanoid";
import bcrypt from 'bcrypt';
const accountSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Account must be associated with a user"],
            unique: true,
            index: true,
        },

        accountTitle: {
            type: String,
            required: [true, "Account title is required"],
            trim: true,
            minlength: [3, "Account title must be at least 3 characters"],
            maxlength: [50, "Account title cannot exceed 50 characters"],
        },

        accountNumber: {
            type: String,
            unique: true,
            index: true,
            default: () => customAlphabet("0123456789", 11)(),
        },

        pin: {
            type: String,
            required: [true, "Transaction PIN is required"],
            minlength: [4, "PIN must be at least 4 digits"],
            select: false,
        },

        currency: {
            type: String,
            default: "PKR",
            immutable: true,
        },

        status: {
            type: String,
            enum: {
                values: ["ACTIVE", "FROZEN", "CLOSED"],
                message: "Status must be ACTIVE, FROZEN, or CLOSED",
            },
            default: "ACTIVE",
        },
    },
    {
        timestamps: true,
    },
);
accountSchema.methods.getBalance = async function () {
    const balanceData = await ledgerModel.aggregate([
        { $match: { account: this._id } },
        {
            $group: {
                _id: null,
                totalDebit: {
                    $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] },
                },
                totalCredit: {
                    $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] },
                },
            },
        },
        {
            $project: {
                _id: 0,
                balance: { $subtract: ["$totalCredit", "$totalDebit"] },
            },
        },
    ]);

    return balanceData.length ? balanceData[0].balance : 0;
};

accountSchema.pre("save", async function () {
    if (!this.isModified("pin")) return;
    this.pin = await bcrypt.hash(this.pin, 12);
});

accountSchema.methods.comparePin = async function (candidatePin) {
    return await bcrypt.compare(candidatePin, this.pin);
};

accountSchema.index({ user: 1, status: 1 });

const accountModel = mongoose.model("Account", accountSchema);
export default accountModel;