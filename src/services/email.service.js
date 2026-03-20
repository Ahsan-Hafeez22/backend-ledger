require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Error connecting to email server:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

const sendEmail = async (to, subject, text, html) => {
    const info = await transporter.sendMail({
        from: `"Registration Success Email" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
    });
    console.log('Message sent: %s', info.messageId);
};

async function sendRegistrationEmail(userEmail, userName) {
    const subject = "Welcome to Our Platform 🎉";
    const text = `Hello ${userName}, welcome to our platform.`;
    const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #222; margin-bottom: 10px;">Welcome, ${userName} 👋</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                We're excited to have you on board.<br>
                Your account has been successfully created.
            </p>
            <div style="margin: 25px 0;">
                <a href="#" style="
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #000;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                ">Get Started</a>
            </div>
            <p style="color: #777; font-size: 13px;">
                If you have any questions, feel free to reach out to our support team.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Your Company. All rights reserved.
            </p>
        </div>
    </div>`;

    await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionEmail(userEmail, userName, amount, transactionId, transactionType = "DEBIT") {
    const subject = `Transaction Alert: ${transactionType} of ${amount} ✔️`;
    const text = `Hello ${userName},\n\nYour account has a new ${transactionType.toLowerCase()} transaction of ${amount}.\nTransaction ID: ${transactionId}.\n\nThank you for using our platform.`;

    const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #222; margin-bottom: 10px;">Hello, ${userName} 👋</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                A new <strong>${transactionType.toLowerCase()}</strong> transaction has been made on your account.<br>
                <strong>Amount:</strong> ${amount}<br>
                <strong>Transaction ID:</strong> ${transactionId}
            </p>
            <div style="margin: 25px 0;">
                <a href="#" style="
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #000;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                ">View Transaction</a>
            </div>
            <p style="color: #777; font-size: 13px;">
                If you have any questions, feel free to reach out to our support team.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Your Company. All rights reserved.
            </p>
        </div>
    </div>`;

    await sendEmail(userEmail, subject, text, html);
}

async function sendFailedTransactionEmail(userEmail, userName, amount, transactionId, transactionType = "DEBIT", reason = "Insufficient balance") {
    const subject = `Transaction Failed: ${transactionType} of ${amount} ❌`;

    const text = `Hello ${userName},

Your ${transactionType.toLowerCase()} transaction of ${amount} could not be completed.
Transaction ID: ${transactionId}
Reason: ${reason}

Please review your account or contact support if you think this is an error.`;

    const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #d32f2f; margin-bottom: 10px;">Transaction Failed ⚠️</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                Your <strong>${transactionType.toLowerCase()}</strong> transaction of <strong>${amount}</strong> could not be completed.<br>
                <strong>Transaction ID:</strong> ${transactionId}<br>
                <strong>Reason:</strong> ${reason}
            </p>
            <div style="margin: 25px 0;">
                <a href="#" style="
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #d32f2f;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                ">Check Your Account</a>
            </div>
            <p style="color: #777; font-size: 13px;">
                If you need assistance, please contact our support team.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Your Company. All rights reserved.
            </p>
        </div>
    </div>`;

    await sendEmail(userEmail, subject, text, html);
}
module.exports = { sendRegistrationEmail, sendTransactionEmail, sendFailedTransactionEmail };