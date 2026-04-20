import mongoose from "mongoose";

const beneficiarySchema = new mongoose.Schema(
    {
        // Who saved this beneficiary (the logged-in user's account)
        savedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            index: true,
        },

        // The recipient's account
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: [true, "Beneficiary must have an account"],
        },

        // A friendly name the user gives them e.g. "Ali Rent"
        nickname: {
            type: String,
            trim: true,
            maxlength: [50, "Nickname cannot exceed 50 characters"],
            default: null
        },
    },
    {
        timestamps: true,
    }
);

// One user cannot save the same account twice
beneficiarySchema.index({ savedBy: 1, account: 1 }, { unique: true });

// Fast lookups:
// - List all beneficiaries saved by a given account
beneficiarySchema.index({ savedBy: 1, createdAt: -1 });
// - Find all occurrences of a recipient account (who saved this account)
beneficiarySchema.index({ account: 1, createdAt: -1 });

const beneficiaryModel = mongoose.model("Beneficiary", beneficiarySchema);
export default beneficiaryModel;