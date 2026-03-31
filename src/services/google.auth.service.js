import { OAuth2Client } from 'google-auth-library';
import userModel from '../models/user.model.js';

const googleClient = new OAuth2Client();

const ACCEPTED_AUDIENCES = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
].filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// verifyGoogleToken
// ─────────────────────────────────────────────────────────────────────────────
const verifyGoogleToken = async (idToken) => {
    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: ACCEPTED_AUDIENCES,
    });
    const payload = ticket.getPayload();
    if (!payload) {
        throw new Error('Empty payload received from Google');
    }

    if (!payload.email_verified) {
        throw new Error('Google account email is not verified');
    }

    return {
        // ── User Identity ─────────────────────────────────────────
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,

        // ── Name Fields ───────────────────────────────────────────
        name: payload.name ?? null,
        firstName: payload.given_name ?? null,
        lastName: payload.family_name ?? null,

        // ── Profile ───────────────────────────────────────────────
        picture: payload.picture ?? null,

        // ── Optional extras ───────────────────────────────────────
        locale: payload.locale ?? null,

        /**
         * hd = Hosted Domain.
         * Only present if user belongs to a Google Workspace org.
         * Example: if hd = "anthropic.com", user signed in with
         * their company Google account.
         * Useful if you ever want to restrict sign-in to specific orgs.
         */
        hostedDomain: payload.hd ?? null,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// findOrCreateGoogleUser
// ─────────────────────────────────────────────────────────────────────────────
const findOrCreateGoogleUser = async ({
    googleId,
    email,
    name,
    firstName,
    lastName,
    picture,
    emailVerified,
    locale,
}) => {
    let user = await userModel.findOne({
        $or: [{ googleId }, { email }],
    });
    if (!user) {
        user = await userModel.create({
            googleId,
            email,
            /**
             * Fallback chain for name:
             * 1. Use full name if Google gave it
             * 2. Try combining first + last name
             * 3. Fall back to email prefix as last resort
             */
            name: name
                ?? [firstName, lastName].filter(Boolean).join(' ')
                ?? email.split('@')[0],
            picture,
            authProvider: 'google',
            verified: true,
            emailVerifiedAt: new Date(),
            lastLoginAt: new Date(),
        });
        return { user, isNewUser: true };
    }
    const isGoogleLinked = !user.googleId;
    // ── Existing user — keep their profile fresh ──────────────────────────────
    // if the user already have an account then there is no need to updating the Auth Provided to Google
    // instead link the google id with it so the backend will know, this is an email user who also connected Google as well
    if (!user.googleId) {
        user.googleId = googleId;
    }

    if (!user.name && name) user.name = name;
    if (!user.picture && picture) user.picture = picture;

    if (emailVerified) user.verified = true;

    if (emailVerified && !user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
    }
    user.lastLoginAt = new Date();

    await user.save();

    return { user, isNewUser: false, isGoogleLinked: isGoogleLinked };
};

export default {
    verifyGoogleToken,
    findOrCreateGoogleUser,
};