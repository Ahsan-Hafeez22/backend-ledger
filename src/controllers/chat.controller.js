import { fetchChatMessages, chatRoom } from "../services/chatService.js";

export const getMessages = async (req, res) => {
    const { senderId, receiverId, page, limit } = req.query;
    try {
        const messages = await fetchChatMessages(
            req.user._id.toString(),  // currentUserId
            senderId,
            receiverId,
            parseInt(page, 10) || 1,
            parseInt(limit, 10) || 20,
        );

        return res.json(messages);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error Fetching Chat Messages" });
    }
};


export const getChatRoomMessages = async (req, res) => {
    try {
        const rooms = await chatRoom(req.user._id.toString());  // ← fixed name
        return res.json(rooms);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error Fetching Rooms" });
    }
};