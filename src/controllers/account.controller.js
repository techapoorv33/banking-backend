const accountModel = require("../models/account.model");


async function createAccountController(req, res) {

    const user = req.user;

    const account= new accountModel({
        user: user._id
    });

    await account.save();

    res.status(201).json({
        account
    })

}

module.exports = {createAccountController};