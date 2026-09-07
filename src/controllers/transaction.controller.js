const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");
/**
 * create a new transaction
 * 10 steps:
 * 1. validate request
 * 2. validate idempotency key
 * 3. check account existence and status
 * 4. derive sender balance from ledger
 * 5. create transaction(PENDING)
 * 6. create DEBIT ledger entry for sender
 * 7. create CREDIT ledger entry for receiver
 * 8. update transaction status to COMPLETED
 * 9. commit mongoDB session
 * 10. send email notification to sender and receiver
 */

async function createTransaction(req, res) {


    // Step 1: validate request

    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
       return res.status(400).json({ message: "From account, to account, amount and idempotency key are required" });
    }

    const fromUserAccount = await accountModel.findOne({ 
        _id: fromAccount,
    })

    const toUserAccount = await accountModel.findOne({ 
        _id: toAccount,
    })

    if (!fromUserAccount || !toUserAccount) {
        return res.status(400).json({ message: "Invalid fromAccount or toAccount" });
    }


    // Step 2: validate idempotency key

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey 
    });

    if (isTransactionAlreadyExists) {
        if(isTransactionAlreadyExists.status === "COMPLETED") {
            return res.status(200).json({ message: "Transaction already completed", transaction: isTransactionAlreadyExists });
        }

        if(isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({ message: "Transaction is already in progress",  });
        }

        if(isTransactionAlreadyExists.status === "FAILED") {
            return res.status(500).json({ message: "Transaction has failed, please retry", });
        }

        if(isTransactionAlreadyExists.status === "REVERSED") {
            return res.status(500).json({ message: "Transaction has been reversed, please retry", });
        }
    }

    // Step 3: check account existence and status

    if(fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({ message: "Both accounts must be active to perform a transaction" });
    }

    // Step 4: derive sender balance from ledger

    const balance = await fromUserAccount.getBalance();

    if(balance < amount) {
        return res.status(400).json({ message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}` });
    }

    // Step 5: create transaction(PENDING)

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = await transactionModel.create({
        fromAccount,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING"
    }, { session } );

    const debitLedgerEntry = await ledgerModel.create({
        account: fromAccount,
        transaction: transaction._id,
        type: "DEBIT",
        amount: amount
    }, { session });

    const creditLedgerEntry = await ledgerModel.create({
        account: toAccount,
        transaction: transaction._id,
        type: "CREDIT",
        amount: amount
    }, { session });

    transaction.status = "COMPLETED";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Step 10: send email notification to sender and receiver

    await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount);

    return res.status(201).json({ message: "Transaction completed successfully", transaction });

}

async function createInitialFundsTransaction(req, res) {

    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({ message: "To account, amount and idempotency key are required" });
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    })

    if (!toUserAccount) {
        return res.status(400).json({ message: "Invalid toAccount" });
    }

    const fromUserAccount = await accountModel.findOne({
        user: req.user._id,
    })

    if (!fromUserAccount) {
        return res.status(400).json({ message: "System user account not found" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({
        fromAccount: fromUserAccount._id,
        toAccount,  
        amount,
        idempotencyKey,
        status: "PENDING"
    });

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"
    }],{ session })

    const creditLedgerEntry = await ledgerModel.create([{
        account: toUserAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT"
    }],{ session })

    transaction.status ="COMPLETED";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession()

    return res.status(201).json({
        message: "Initial funds transaction completed successfully",
        transaction:transaction
    })

}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}