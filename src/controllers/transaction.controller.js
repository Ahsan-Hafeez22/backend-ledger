const transactionModel = require("../models/transaction.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.model");
const ledgerModel = require("../models/ledger.model");
const mongoose = require("mongoose");
const emailService = require('../services/email.service');

async function createTransaction(req, resp) {
    try {
        const { fromAccount, toAccount, amount, idempotencyKey } = req.body;
        if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
            return resp
                .status(400)
                .json({
                    message:
                        "FromAccount, ToAccount, amount, idempotencyKey are required",
                });
        }

        const fromUserAccount = await accountModel.findById(fromAccount);
        const toUserAccount = await accountModel.findById(toAccount);
        if (!fromUserAccount || !toUserAccount) {
            return resp
                .status(400)
                .json({ message: "Invalid FromAccount or ToAccount" });
        }

        // 2. Validate Idempotency Key
        const isTransactionAlreadyExsist = await transactionModel.findOne({
            idempotencyKey,
        });
        if (isTransactionAlreadyExsist) {
            if (isTransactionAlreadyExsist.status === "COMPLETED") {
                return resp.status(200).json({
                    message: "Transaction already proceeded",
                    transaction: isTransactionAlreadyExsist,
                });
            }
            if (isTransactionAlreadyExsist.status === "PENDING") {
                return resp
                    .status(200)
                    .json({ message: "Transaction is still processing" });
            }
            if (isTransactionAlreadyExsist.status === "FAILED") {
                return resp
                    .status(500)
                    .json({ message: "Transaction processing Failed" });
            }

            if (isTransactionAlreadyExsist.account === "REVERSED") {
                return resp
                    .status(200)
                    .json({ message: "Transaction was reversed, please retry" });
            }
        }

        // 3. Validate FromAccount and ToAccount Status
        if (
            fromUserAccount.status !== "Active" ||
            toUserAccount.status !== "Active"
        ) {
            return resp
                .status(400)
                .json({
                    message:
                        "Both from account and to account must be active to proceed transaction",
                });
        }

        // 4. Derive sender balance from ledger
        const balance = await fromUserAccount.getBalance();
        if (balance < amount) {
            return resp
                .status(400)
                .json({
                    message: `Insufficient Balance.\nCurrent Balance: ${balance}\nReqested Amount: ${amount}`,
                });
        }

        // 5. create tranasaction
        const session = await mongoose.startSession();
        session.startTransaction();

        const transaction = (await transactionModel.create(
            [{
                fromAccount: fromUserAccount._id,
                toAccount: toAccount,
                amount,
                idempotencyKey,
                status: "PENDING",
            }],
            { session })
        )[0];



        const debitLedgetEntry = await ledgerModel.create(
            [{
                account: fromAccount,
                type: "DEBIT",
                amount,
                transaction: transaction._id,
            }],
            { session },
        );
        await (() => {
            return new Promise((resolve) => setTimeout(resolve, 2 * 1000));
        })()

        const creditLedgetEntry = await ledgerModel.create(
            [{
                account: toAccount,
                type: "CREDIT",
                amount,
                transaction: transaction._id,
            }],
            { session },
        );

        transaction.status = "COMPLETED";
        await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session }

        )

        await session.commitTransaction();
        session.endSession();

        const toUser = await userModel.findById(toUserAccount.user);
        console.log("user details", toUser);
        emailService.sendTransactionEmail(req.user.email, req.user.name, amount, transaction._id, "CREDIT")
            .catch(err => console.error('Error sending registration email:', err));
        if (!toUser) {
            console.log("Receiver user not found");
        } else {
            emailService.sendTransactionEmail(
                toUser.email,
                toUser.name,
                amount,
                transaction._id,
                "CREDIT"
            ).catch(err => console.error('Error sending email to receiver:', err));
        }
        return resp.status(201).json({
            message: "Transaction Complete Successfully",
            transaction: transaction
        });
    } catch (error) {
        console.log(error);
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
            _id: toAccount,
        })

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
                toAccount: toAccount,
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
                    account: toAccount,
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

        console.log(error);

        return resp.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}


async function getUserAccountController(req, resp) {
    try {
        const user = await req.user;

        return resp.status(200).json({ balance });
    } catch (error) {
        return resp.status(500).json({ message: "Internal Server Error" });
    }
}
module.exports = { createTransaction, createInitialFundTransaction };
