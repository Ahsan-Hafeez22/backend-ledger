const userModel = require('../models/user.model')
const jwt = require('jsonwebtoken');
const emailService = require('../services/email.service');

async function userRegisterController(req, res) {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: "All fields are required"
            });
        }

        const userAlreadyExists = await userModel.findOne({ email });
        if (userAlreadyExists) {
            return res.status(422).json({
                statusCode: 422,
                status: 'failed',
                message: "User already exists with this email"
            });
        }

        const user = await userModel.create({ email, name, password });

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie('token', token);

        emailService.sendRegistrationEmail(user.email, user.name)
            .catch(err => console.error('Error sending registration email:', err));

        return res.status(201).json({
            statusCode: 201,
            status: 'success',
            message: "User registered successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            accessToken: token
        });

    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({
            statusCode: 500,
            status: 'failed',
            message: "Internal server error"
        });
    }
}

async function userLoginController(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: "All fields are required"
            });
        }

        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            return res.status(422).json({
                statusCode: 422,
                status: 'failed',
                message: "Invalid Credentials"
            });
        }

        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(422).json({
                statusCode: 422,
                status: 'failed',
                message: "Invalid Credentials"
            });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie('token', token);

        return res.status(200).json({
            statusCode: 200,
            status: 'success',
            message: "User Logged in successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            accessToken: token
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            statusCode: 500,
            status: 'failed',
            message: "Internal server error"
        });
    }
}

module.exports = { userRegisterController, userLoginController };