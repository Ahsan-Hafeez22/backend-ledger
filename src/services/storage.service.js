import ImageKit from '@imagekit/nodejs';
const imagekit = new ImageKit({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

async function uploadImage(buffer, fileName) {
    try {
        const response = await imagekit.files.upload({
            file: buffer.toString("base64"),
            fileName: fileName,
        });

        return response;
    } catch (error) {
        console.error("Image upload failed:", error);
        throw error;
    }
}

export default { uploadImage };