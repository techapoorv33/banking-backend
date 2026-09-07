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


async function getUserAccountController(req, res){

    const accounts = await accountModel.find({ user : req.user._id });

    res.status(200).json({
        accounts
    })
}

module.exports = {createAccountController, getUserAccountController};