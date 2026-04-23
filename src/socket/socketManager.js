// Why a Map? Because it's O(1) lookup.
// Structure: { userId (string) → socketId (string) }
// We need this to:
//   1. Check if a user is online before emitting
//   2. Deliver messages to the right socket
//   3. Tell the sender their message was delivered

// Map<userId, Set<socketId>>
const onlineUsers = new Map();

export const addUser = (userId, socketId) => {
    const key = userId.toString();
    const set = onlineUsers.get(key) ?? new Set();
    set.add(socketId);
    onlineUsers.set(key, set);
};

export const removeUser = (userId, socketId) => {
    const key = userId.toString();
    const set = onlineUsers.get(key);
    if (!set) return;
    if (socketId) set.delete(socketId);
    if (!socketId || set.size === 0) onlineUsers.delete(key);
};

export const getSocketId = (userId) => {
    const set = onlineUsers.get(userId.toString());
    if (!set || set.size === 0) return undefined;
    // return any one socketId (use rooms for multi-socket broadcast)
    return [...set][0];
};

export const isUserOnline = (userId) => {
    const set = onlineUsers.get(userId.toString());
    return Boolean(set && set.size > 0);
};

// For debugging — see all online users
export const getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
};