const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");

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
}