import transactionModel from "../models/transaction.model.js";
import accountModel from "../models/account.model.js";
import userModel from "../models/user.model.js";
import ledgerModel from "../models/ledger.model.js";
import mongoose from "mongoose";
import emailService from '../services/email.service.js';

async function createTransaction(req, resp) {
    const session = await mongoose.startSession();
    try {
        const { toAccount, amount, idempotencyKey, description } = req.body;

        // 1. Resolve fromAccount from token (logged in user)
        const fromUserAccount = await accountModel.findOne({ user: req.user._id });
        if (!fromUserAccount) {
            return resp.status(404).json({ message: "Your account not found" });
        }

        // 2. Resolve toAccount by accountNumber (user facing)
        const toUserAccount = await accountModel.findOne({ accountNumber: toAccount });
        if (!toUserAccount) {
            return resp.status(400).json({ message: "Recipient account not found" });
        }

        // 3. Prevent sending to self
        if (fromUserAccount._id.toString() === toUserAccount._id.toString()) {
            return resp.status(400).json({ message: "Cannot send money to your own account" });
        }

        // 4. Validate idempotency key
        const existingTransaction = await transactionModel.findOne({ idempotencyKey });
        if (existingTransaction) {
            if (existingTransaction.status === "COMPLETED") {
                return resp.status(200).json({
                    message: "Transaction already completed",
                    transaction: existingTransaction,
                });
            }
            if (existingTransaction.status === "PENDING") {
                return resp.status(200).json({ message: "Transaction is still processing" });
            }
            if (existingTransaction.status === "FAILED") {
                return resp.status(500).json({ message: "Transaction previously failed" });
            }
            if (existingTransaction.status === "REVERSED") {
                return resp.status(400).json({ message: "Transaction was reversed" });
            }
        }

        // 5. Validate both accounts are ACTIVE
        if (fromUserAccount.status !== "ACTIVE") {
            return resp.status(400).json({ message: "Your account is not active" });
        }
        if (toUserAccount.status !== "ACTIVE") {
            return resp.status(400).json({ message: "Recipient account is not active" });
        }

        // 6. Check sender balance
        const balance = await fromUserAccount.getBalance();
        if (balance < amount) {
            return resp.status(400).json({
                message: `Insufficient balance. Available: ${balance}, Requested: ${amount}`
            });
        }

        // 7. Run transaction atomically
        session.startTransaction();

        const [transaction] = await transactionModel.create(
            [{
                fromAccount: fromUserAccount._id,
                toAccount: toUserAccount._id,
                amount,
                idempotencyKey,
                description: description || '',
                status: "PENDING",
            }],
            { session }
        );

        await ledgerModel.create(
            [
                {
                    account: fromUserAccount._id,
                    type: "DEBIT",
                    amount,
                    transaction: transaction._id,
                },
                {
                    account: toUserAccount._id,
                    type: "CREDIT",
                    amount,
                    transaction: transaction._id,
                }
            ],
            { session, ordered: true }
        );

        await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        // 8. Send emails fire-and-forget
        const toUser = await userModel.findById(toUserAccount.user).select('name email');

        emailService.sendTransactionEmail(
            req.user.email,
            req.user.name,
            amount,
            transaction._id,
            "DEBIT"
        ).catch(err => console.error('Error sending sender email:', err));

        if (toUser) {
            emailService.sendTransactionEmail(
                toUser.email,
                toUser.name,
                amount,
                transaction._id,
                "CREDIT"
            ).catch(err => console.error('Error sending receiver email:', err));
        }

        return resp.status(201).json({
            statusCode: 201,
            status: "success",
            message: "Transaction completed successfully",
            transaction
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("[createTransaction]", error);
        return resp.status(500).json({ message: "Internal Server Error" });
    }
}

async function createInitialFundTransaction(req, resp) {
    const session = await mongoose.startSession();

    try {
        const { toAccount, amount, idempotencyKey } = req.body;


        if (!toAccount || !amount || !idempotencyKey) {
            return resp.status(400).json({
                message: "toAccount, amount and idempotencyKey are required"
            })
        }

        const toUserAccount = await accountModel.findOne({
            accountNumber: toAccount,
        })
        console.log("To uSer account: ", toUserAccount);
        if (!toUserAccount) {
            return resp.status(400).json({
                message: "Invalid toAccount"
            })
        }

        const fromUserAccount = await accountModel.findOne({
            user: req.user._id
        })

        if (!fromUserAccount) {
            return resp.status(400).json({
                message: "System user account not found"
            })
        }

        console.log("fromAccount", fromUserAccount);
        session.startTransaction();

        // ✅ FIX 1: use create + correct field name
        const transaction = await transactionModel.create(
            [{
                fromAccount: fromUserAccount._id,
                toAccount: toUserAccount._id,
                amount,
                idempotencyKey,
                status: "PENDING",
            }],
            { session }
        );

        const txn = transaction[0];


        await ledgerModel.create(
            [
                {
                    account: fromUserAccount._id,
                    amount,
                    type: "DEBIT",
                    transaction: txn._id,
                },
                {
                    account: toUserAccount._id,
                    amount,
                    type: "CREDIT",
                    transaction: txn._id,
                }
            ],
            { session, ordered: true }
        );

        txn.status = "COMPLETED";
        await txn.save({ session });

        await session.commitTransaction();
        session.endSession();

        return resp.status(201).json({
            message: "Transaction Successful",
            transaction: txn,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();


        console.error("[initialFund]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function getTransactionDetail(req, res) {
    const { transactionId } = req.params;
    try {
        console.log("transactionId", transactionId);
        const transaction = await transactionModel.findById(transactionId)
            .populate({
                path: 'fromAccount',
                select: 'accountNumber accountTitle currency status',
                populate: {
                    path: 'user',
                    select: 'name email'
                }
            })
            .populate({
                path: 'toAccount',
                select: 'accountNumber accountTitle currency status',
                populate: {
                    path: 'user',
                    select: 'name email'
                }
            });;
        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message:
                "Transaction details fetched successfully",
            transaction: transaction
        });
    } catch (error) {
        console.error("[getTransactionDetail]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function getTransactions(req, res) {
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    try {
        const user = req.user;
        const account = await accountModel.findOne({ user: user._id });
        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }
        console.log("Logged in user:", req.user._id);
        console.log("Found account:", account?._id);
        const filter = {
            $or: [{ fromAccount: account._id }, { toAccount: account._id }]
        }
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$gte = new Date(endDate);
        }
        const skip = (Number(page) - 1) * Number(limit);
        const total = await transactionModel.countDocuments(filter);
        const transactions = await transactionModel.find(filter)
            .populate(
                { path: 'fromAccount', select: 'accountNumber accountTitle', populate: { path: 'user', select: 'name email' } }
            )
            .populate(
                { path: 'toAccount', select: 'accountNumber accountTitle', populate: { path: 'user', select: 'name email' } }
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const tagged = transactions.map(txn => ({
            ...txn,
            direction: txn.fromAccount._id.toString() === account._id.toString()
                ? 'DEBIT'
                : 'CREDIT'
        }));

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Transactions fetched successfully",
            data: {
                transactions: tagged,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                    hasNextPage: Number(page) < Math.ceil(total / Number(limit)),
                }
            }
        });
    } catch (error) {
        console.error("[getTransactions]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }

}

async function getTransactionByIdempotencyKey(req, resp) {
    try {
        const { idempotencyKey } = req.query;

        const transaction = await transactionModel
            .findOne({ idempotencyKey })
            .populate('fromAccount', 'accountNumber')
            .populate('toAccount', 'accountNumber');

        if (!transaction) {
            return resp.status(404).json({ message: "Transaction not found" });
        }

        return resp.status(200).json({
            statusCode: 200,
            status: "success",
            data: {
                transactionId: transaction._id,
                status: transaction.status,  // PENDING, COMPLETED, FAILED, REVERSED
                amount: transaction.amount,
                createdAt: transaction.createdAt
            }
        });

    } catch (error) {
        console.error("[getTransactionByIdempotencyKey]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function verifyPin(req, resp) {
    try {
        const { pin } = req.body;
        const user = req.user;

        const account = await accountModel.findOne({ user: user._id })
            .select('+pin +pinAttempt +pinLockedUntil');
        if (!account) {
            return resp.status(404).json({ message: "Account not found" });
        }
        if (account.pinLockedUntil && account.pinLockedUntil > new Date()) {
            const minutesLeft = Math.ceil(
                (account.pinLockedUntil - new Date()) / 1000 / 60
            );
            return resp.status(403).json({
                message: `Account locked. Try again in ${minutesLeft} minute(s).`,
                lockedUntil: account.pinLockedUntil,
            });
        }

        const pinMatch = await account.comparePin(pin);
        if (pinMatch) {
            account.pinAttempt = 0;
            account.pinLockedUntil = null;
            await account.save();

            return resp.status(200).json({
                statusCode: 200,
                status: "success",
                message: "PIN verified successfully",
            });


        } else {
            account.pinAttempt += 1;

            if (account.pinAttempt >= 3) {
                account.status = 'FROZEN';
                account.pinLockedUntil = new Date(Date.now() + 60 * 60 * 1000);
                account.pinAttempt = 0;
                await account.save();

                return resp.status(403).json({
                    message: "Too many failed attempts. Account frozen for 1 hour.",
                    lockedUntil: account.pinLockedUntil,
                });
            }

            await account.save();

            return resp.status(400).json({
                statusCode: 400,
                status: "failed",
                message: `Incorrect PIN. ${3 - account.pinAttempt} attempt(s) remaining.`,
                attemptsLeft: 3 - account.pinAttempt,
            });
        }
    } catch (error) {
        console.error("[verifyPin]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });

    }
}
export default { createTransaction, createInitialFundTransaction, getTransactionDetail, getTransactions, getTransactionByIdempotencyKey, verifyPin };
