const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: [true, "Transaction must be associated with from account"],
        index: true,
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: [true, "Transaction must be associated with to account"],
        index: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', "REVERSED"],
        message: 'Status can be either pending, completed, failed or reversed ',
        default: 'PENDING'
    },
    amount: {
        type: Number,
        required: [true, "Transaction must have an amount"],
        min: [0, 'Transaction amount can not be negative'],


    },
    idempotencyKey: {
        type: String,
        required: [true, "Transaction must have an idempotency key"],
        unique: true,
        index: true,
    }

}
    , {
        timestamps: true
    }
);

const transactionModel = mongoose.model('Transaction', transactionSchema);
module.exports = transactionModel;