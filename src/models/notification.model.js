import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        body: {
            type: String,
            required: true,
            maxlength: 500,
        },
        imageUrl: {
            type: String,
            default: null,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        readAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

const notificationModel = mongoose.model('Notification', notificationSchema);
export default notificationModel;

