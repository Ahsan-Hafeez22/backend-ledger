import multer from 'multer';

const storage = multer.memoryStorage(); // keeps file in buffer, not disk

const avatarUploader = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
    }
});

// Multer becomes an Express middleware only after calling `.single()` / `.array()` / `.fields()`.
// Frontend must send the file under field name: "avatar".
export const uploadAvatar = (req, res, next) => {
    avatarUploader.single('avatar')(req, res, (err) => {
        if (!err) return next();

        // Multer errors (file too large, etc.)
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: err.message,
            });
        }

        // File filter / other errors
        return res.status(400).json({
            statusCode: 400,
            status: 'failed',
            message: err?.message ?? 'Invalid file upload',
        });
    });
};