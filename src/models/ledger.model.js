import mongoose from 'mongoose';

const ledgerScema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: [true, 'Ledger must be associated with an account'],
        index: true,
        immutable: true,
    },
    amount: {
        type: Number,
        required: [true, 'Ledger must have an amount'],
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true,
        immutable: true
    }
    ,
    type: {
        type: String,
        enum: ['DEBIT', 'CREDIT'],
        message: 'Ledger can be either Debit or Credit ',
        immutable: true
    },
});

function preventLedgerModification() {
    throw new Error('Ledger cannot be modified');
}

ledgerScema.pre('findOneAndUpdate', preventLedgerModification);
ledgerScema.pre('updateOne', preventLedgerModification);
ledgerScema.pre('deleteOne', preventLedgerModification);
ledgerScema.pre('remove', preventLedgerModification);
ledgerScema.pre('deleteMany', preventLedgerModification);
ledgerScema.pre('updateMany', preventLedgerModification);
ledgerScema.pre('findOneAndDelete', preventLedgerModification);
ledgerScema.pre('findOneAndReplace', preventLedgerModification);


const ledgerModel = mongoose.model('Ledger', ledgerScema);
export default ledgerModel;
