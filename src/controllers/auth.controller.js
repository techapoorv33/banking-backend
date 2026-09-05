const userModel = require("../models/user.model");
const jwt= require("jsonwebtoken");
const emailService = require("../services/email.service");

async function UserRegisterController(req, res) {
    const { name, email, password } = req.body;

    const isExists = await userModel.findOne({ email: email });

    if(isExists) {
        return res.status(422).json({ 
            message: "User already exists",
            status: "failed"
        });
    }


    const user = await userModel.create({
        email, password, name
    });

    const token= jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" });

    res.cookie("token", token)

    res.status(201).json({
        user: {
            _id: user._id,
            name: user.name,
            email: user.email
        },
        token 
    })

    await emailService.sendRegistrationEmail(user.email, user.name);
}

async function UserLoginController(req, res) {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email }).select("+password");

    if(!user){
        return res.status(404).json({
            message: "Email or Password is incorrect"
        })
    }

    const isValidPasswordu=await user.comparePassword(password)

    if(!isValidPasswordu){
        return res.status(404).json({
            message: "Email or Password is incorrect"
        })
    }

    const token= jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" });

    res.cookie("token", token)

    res.status(200).json({
        user: {
            _id: user._id,
            name: user.name,
            email: user.email
        },
        token 
    })

}


module.exports={ UserRegisterController, UserLoginController }