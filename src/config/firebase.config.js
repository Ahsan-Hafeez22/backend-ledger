// src/config/firebase.js
import admin from 'firebase-admin';
import path from 'path';

let firebaseApp;

export const initializeFirebase = () => {
    if (firebaseApp) return firebaseApp; // singleton guard

    try {

        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        console.log('[Firebase] Admin SDK initialized successfully');
        return firebaseApp;
    } catch (err) {
        console.error('[Firebase] Failed to initialize Admin SDK:', err.message);
        process.exit(1); // fatal — don't run without FCM
    }
};

export const getMessaging = () => {
    if (!firebaseApp) initializeFirebase();
    return admin.messaging();
};


