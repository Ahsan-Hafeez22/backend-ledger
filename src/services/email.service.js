// services/email.service.js
import nodemailer from "nodemailer";
import 'dotenv/config';

// Create transporter with OAuth2
console.log(process.env.EMAIL_USER, process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REFRESH_TOKEN)
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

// Verify transporter connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Error connecting to email server:', error.message);
    } else {
        console.log('✅ Email server (Gmail OAuth2) is ready to send messages');
    }
});

// Generic send email function
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Ledger App" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log(`📧 Email sent successfully: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        throw new Error(`Email sending failed: ${error.message}`);
    }
};

// ==================== Email Functions ====================

export const sendRegistrationEmail = async (userEmail, userName) => {
    const subject = "Welcome to Ledger App 🎉";

    const text = `Hello ${userName},\n\nWelcome to Ledger App! Your account has been successfully created.`;

    const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #222; margin-bottom: 10px;">Welcome, ${userName} 👋</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                We're excited to have you on board.<br>
                Your account has been successfully created.
            </p>
            <div style="margin: 25px 0;">
                <a href="#" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                    Get Started
                </a>
            </div>
            <p style="color: #777; font-size: 13px;">
                If you have any questions, feel free to reach out to our support team.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Ledger App. All rights reserved.
            </p>
        </div>
    </div>`;

    return sendEmail(userEmail, subject, text, html);
};

export const sendTransactionEmail = async (userEmail, userName, amount, transactionId, transactionType = "DEBIT") => {
    const subject = `Transaction Alert: ${transactionType} of ${amount}`;

    const text = `Hello ${userName},\n\nYour account has a new ${transactionType.toLowerCase()} transaction of ${amount}.\nTransaction ID: ${transactionId}.`;

    const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #222; margin-bottom: 10px;">Hello, ${userName} 👋</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                A new <strong>${transactionType}</strong> transaction has been made on your account.<br>
                <strong>Amount:</strong> ${amount}<br>
                <strong>Transaction ID:</strong> ${transactionId}
            </p>
            <div style="margin: 25px 0;">
                <a href="#" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                    View Transaction
                </a>
            </div>
            <p style="color: #777; font-size: 13px;">
                If you have any questions, feel free to reach out to our support team.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Ledger App. All rights reserved.
            </p>
        </div>
    </div>`;

    return sendEmail(userEmail, subject, text, html);
};

export const sendFailedTransactionEmail = async (userEmail, userName, amount, transactionId, transactionType = "DEBIT", reason = "Insufficient balance") => {
    const subject = `Transaction Failed: ${transactionType} of ${amount} ❌`;

    const text = `Hello ${userName},\n\nYour ${transactionType.toLowerCase()} transaction of ${amount} could not be completed.\nTransaction ID: ${transactionId}\nReason: ${reason}`;

    const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #d32f2f; margin-bottom: 10px;">Transaction Failed ⚠️</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                Your <strong>${transactionType}</strong> transaction of <strong>${amount}</strong> could not be completed.<br>
                <strong>Transaction ID:</strong> ${transactionId}<br>
                <strong>Reason:</strong> ${reason}
            </p>
            <div style="margin: 25px 0;">
                <a href="#" style="display: inline-block; padding: 12px 24px; background-color: #d32f2f; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                    Check Your Account
                </a>
            </div>
            <p style="color: #777; font-size: 13px;">
                If you need assistance, please contact our support team.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                © ${new Date().getFullYear()} Ledger App. All rights reserved.
            </p>
        </div>
    </div>`;

    return sendEmail(userEmail, subject, text, html);
};

// Default export (so you can import as: import emailService from './email.service.js')
export default {
    sendRegistrationEmail,
    sendTransactionEmail,
    sendFailedTransactionEmail
};