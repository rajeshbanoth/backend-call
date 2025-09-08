const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Configure properly for production
    methods: ["GET", "POST"],
  },
});

// Data structures to manage calls and users
const activeCalls = new Map(); // roomId -> callData
const userSockets = new Map(); // userId -> socketId
const userRooms = new Map(); // userId -> roomId

// Logging utility
const log = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...meta }));
};

// Utility functions
const isValidCallData = (data) => {
  const isValid = data && data.callerId && data.receiverId && data.type;
  if (!isValid) {
    log("warn", "Invalid call data received", { data });
  }
  return isValid;
};

const getCallByUserId = (userId) => {
  for (const [roomId, callData] of activeCalls.entries()) {
    if (callData.participants.includes(userId)) {
      return { roomId, callData };
    }
  }
  return null;
};

const isUserInCall = (userId) => {
  const inCall = userRooms.has(userId);
  log("debug", "Checking if user is in call", { userId, inCall });
  return inCall;
};

// Middleware to authenticate socket connections
io.use((socket, next) => {
  const { userId } = socket.handshake.query;
  if (!userId) {
    log("error", "Authentication error: userId required", { socketId: socket.id });
    return next(new Error("Authentication error: userId required"));
  }
  socket.userId = userId;
  log("info", "User authentication successful", { userId, socketId: socket.id });
  next();
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  log("info", "User connected", { userId, socketId: socket.id });

  // Store user socket mapping
  userSockets.set(userId, socket.id);
  socket.join(userId);
  log("debug", "User joined their own room", { userId, socketId: socket.id });

  // Handle call initiation
  socket.on("call:initiate", (callData) => {
    try {
      log("info", "Call initiation requested", { userId, callData });
      if (!isValidCallData(callData)) {
        socket.emit("call:signal-error", { message: "Invalid call data" });
        return;
      }

      // Check if receiver is available
      if (isUserInCall(callData.receiverId)) {
        log("warn", "Receiver is already in a call", {
          userId,
          receiverId: callData.receiverId,
        });
        socket.emit("call:busy", callData);
        return;
      }

      const roomId = callData.roomId || uuidv4();
      callData.roomId = roomId;
      callData.participants = [callData.callerId];
      callData.timestamp = Date.now();
      callData.status = "ringing";

      // Store call data
      activeCalls.set(roomId, callData);
      userRooms.set(callData.callerId, roomId);
      log("info", "Call data stored", { roomId, callData });

      // Join the room
      socket.join(roomId);
      log("debug", "Caller joined call room", { userId, roomId });

      // Notify receiver with the offer
      io.to(callData.receiverId).emit("call:incoming", {
        ...callData,
        offer: callData.offer,
      });
      log("info", "Notified receiver of incoming call", {
        receiverId: callData.receiverId,
        roomId,
      });

      // Notify caller that call is ringing
      socket.emit("call:ringing", callData);
      log("debug", "Notified caller of ringing status", { userId, roomId });
    } catch (error) {
      log("error", "Error in call initiation", { userId, roomId: callData.roomId, error: error.message });
      socket.emit("call:signal-error", { message: "Failed to initiate call" });
    }
  });

  // Handle call acceptance
  socket.on("call:accept", (callData) => {
    try {
      const { roomId } = callData;
      const call = activeCalls.get(roomId);
      log("info", "Call acceptance requested", { userId, roomId });

      if (!call) {
        log("warn", "Call does not exist", { userId, roomId });
        socket.emit("call:signal-error", { message: "Call does not exist" });
        return;
      }

      // Update call data
      call.status = "in-call";
      call.participants.push(callData.receiverId);
      activeCalls.set(roomId, call);
      userRooms.set(callData.receiverId, roomId);
      log("info", "Call status updated to in-call", { roomId, participants: call.participants });

      // Join the room
      socket.join(roomId);
      log("debug", "Receiver joined call room", { userId, roomId });

      // Notify all participants
      io.to(roomId).emit("call:accepted", callData);
      io.to(roomId).emit("call:connected", callData);
      log("info", "Notified participants of call acceptance and connection", { roomId });
    } catch (error) {
      log("error", "Error in call acceptance", { userId, roomId: callData.roomId, error: error.message });
      socket.emit("call:signal-error", { message: "Failed to accept call" });
    }
  });

  // Handle call rejection
  socket.on("call:reject", (callData) => {
    try {
      const { roomId } = callData;
      const call = activeCalls.get(roomId);
      log("info", "Call rejection requested", { userId, roomId });

      if (call) {
        io.to(roomId).emit("call:rejected", callData);
        cleanupCall(roomId);
        log("info", "Notified participants of call rejection and cleaned up", { roomId });
      } else {
        log("warn", "Attempted to reject non-existent call", { userId, roomId });
      }
    } catch (error) {
      log("error", "Error in call rejection", { userId, roomId: callData.roomId, error: error.message });
    }
  });

  // Handle call end
  socket.on("call:end", (callData) => {
    try {
      const { roomId } = callData;
      const call = activeCalls.get(roomId);
      log("info", "Call end requested", { userId, roomId });

      if (call) {
        io.to(roomId).emit("call:ended", callData);
        cleanupCall(roomId);
        log("info", "Notified participants of call end and cleaned up", { roomId });
      } else {
        log("warn", "Attempted to end non-existent call", { userId, roomId });
      }
    } catch (error) {
      log("error", "Error in call end", { userId, roomId: callData.roomId, error: error.message });
    }
  });

  // Handle WebRTC signaling
  socket.on("call:offer", (data) => {
    try {
      const targetId = data.senderId === data.callerId ? data.receiverId : data.callerId;
      log("debug", "Relaying WebRTC offer", { userId, targetId, roomId: data.roomId });
      io.to(targetId).emit("call:offer", data);
    } catch (error) {
      log("error", "Error relaying WebRTC offer", { userId, roomId: data.roomId, error: error.message });
    }
  });

  socket.on("call:answer", (data) => {
    try {
      const targetId = data.senderId === data.callerId ? data.receiverId : data.callerId;
      log("debug", "Relaying WebRTC answer", { userId, targetId, roomId: data.roomId });
      io.to(targetId).emit("call:answer", data);
    } catch (error) {
      log("error", "Error relaying WebRTC answer", { userId, roomId: data.roomId, error: error.message });
    }
  });

  socket.on("call:candidate", (data) => {
    try {
      log("debug", "Relaying ICE candidate", { userId, targetId: data.targetId, roomId: data.roomId });
      io.to(data.targetId).emit("call:candidate", data);
    } catch (error) {
      log("error", "Error relaying ICE candidate", { userId, roomId: data.roomId, error: error.message });
    }
  });

  // Handle media control events
  socket.on("call:mute-toggle", (data) => {
    try {
      const { roomId } = data;
      log("info", "Mute toggle requested", { userId, roomId, isMuted: data.isMuted });
      socket.to(roomId).emit("call:mute-toggle", data);
    } catch (error) {
      log("error", "Error in mute toggle", { userId, roomId, error: error.message });
    }
  });

  socket.on("call:video-toggle", (data) => {
    try {
      const { roomId } = data;
      log("info", "Video toggle requested", { userId, roomId, isVideoEnabled: data.isVideoEnabled });
      socket.to(roomId).emit("call:video-toggle", data);
    } catch (error) {
      log("error", "Error in video toggle", { userId, roomId, error: error.message });
    }
  });

  // Handle call hold/resume
  socket.on("call:hold", (callData) => {
    try {
      const { roomId } = callData;
      log("info", "Call hold requested", { userId, roomId });
      socket.to(roomId).emit("call:hold", callData);
    } catch (error) {
      log("error", "Error in call hold", { userId, roomId: callData.roomId, error: error.message });
    }
  });

  socket.on("call:resume", (callData) => {
    try {
      const { roomId } = callData;
      log("info", "Call resume requested", { userId, roomId });
      socket.to(roomId).emit("call:resume", callData);
    } catch (error) {
      log("error", "Error in call resume", { userId, roomId: callData.roomId, error: error.message });
    }
  });

  // Handle screen sharing
  socket.on("call:screen-sharing-started", (data) => {
    try {
      const { roomId } = data;
      log("info", "Screen sharing started", { userId, roomId });
      socket.to(roomId).emit("call:screen-sharing-started", data);
    } catch (error) {
      log("error", "Error in screen sharing started", { userId, roomId, error: error.message });
    }
  });

  socket.on("call:screen-sharing-stopped", (data) => {
    try {
      const { roomId } = data;
      log("info", "Screen sharing stopped", { userId, roomId });
      socket.to(roomId).emit("call:screen-sharing-stopped", data);
    } catch (error) {
      log("error", "Error in screen sharing stopped", { userId, roomId, error: error.message });
    }
  });

  // Handle participant management
  socket.on("call:participant-added", (data) => {
    try {
      const { roomId, userId: newUserId } = data;
      const call = activeCalls.get(roomId);
      log("info", "Participant addition requested", { userId, newUserId, roomId });

      if (call && !call.participants.includes(newUserId)) {
        call.participants.push(newUserId);
        activeCalls.set(roomId, call);
        userRooms.set(newUserId, roomId);
        io.to(roomId).emit("call:participant-added", data);
        log("info", "Participant added successfully", { newUserId, roomId, participants: call.participants });
      } else {
        log("warn", "Participant addition failed: already in call or call does not exist", {
          newUserId,
          roomId,
        });
      }
    } catch (error) {
      log("error", "Error adding participant", { userId, roomId: data.roomId, error: error.message });
    }
  });

  socket.on("call:participant-removed", (data) => {
    try {
      const { roomId, userId: removedUserId } = data;
      const call = activeCalls.get(roomId);
      log("info", "Participant removal requested", { userId, removedUserId, roomId });

      if (call) {
        call.participants = call.participants.filter(p => p !== removedUserId);
        activeCalls.set(roomId, call);
        userRooms.delete(removedUserId);
        io.to(roomId).emit("call:participant-removed", data);
        log("info", "Participant removed successfully", { removedUserId, roomId, participants: call.participants });

        // If no participants left, clean up the call
        if (call.participants.length === 0) {
          cleanupCall(roomId);
        }
      } else {
        log("warn", "Attempted to remove participant from non-existent call", { removedUserId, roomId });
      }
    } catch (error) {
      log("error", "Error removing participant", { userId, roomId: data.roomId, error: error.message });
    }
  });

  // Handle user disconnection
  socket.on("disconnect", (reason) => {
    log("info", "User disconnected", { userId, socketId: socket.id, reason });

    // Clean up user data
    userSockets.delete(userId);
    const roomId = userRooms.get(userId);

    if (roomId) {
      const call = activeCalls.get(roomId);
      if (call) {
        // Notify other participants
        socket.to(roomId).emit("call:participant-removed", {
          roomId,
          userId,
          reason: "disconnected",
        });
        log("info", "Notified participants of user disconnection", { userId, roomId });

        // Remove user from call
        call.participants = call.participants.filter(p => p !== userId);
        activeCalls.set(roomId, call);
        log("debug", "User removed from call participants", { userId, roomId, participants: call.participants });

        // If no participants left, clean up the call
        if (call.participants.length === 0) {
          cleanupCall(roomId);
        }
      }
      userRooms.delete(userId);
      log("debug", "User removed from userRooms", { userId, roomId });
    }
  });

  // Handle errors
  socket.on("error", (error) => {
    log("error", "Socket error", { userId, socketId: socket.id, error: error.message });
  });
});

// Clean up call resources
function cleanupCall(roomId) {
  const call = activeCalls.get(roomId);
  if (call) {
    // Remove all participants from userRooms
    call.participants.forEach(userId => {
      userRooms.delete(userId);
      log("debug", "Removed user from userRooms during cleanup", { userId, roomId });
    });

    // Remove the call
    activeCalls.delete(roomId);
    log("info", "Cleaned up call", { roomId, participants: call.participants });
  } else {
    log("warn", "Attempted to clean up non-existent call", { roomId });
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  log("info", "Health check requested", { activeCalls: activeCalls.size, connectedUsers: userSockets.size });
  res.status(200).json({
    status: "OK",
    activeCalls: activeCalls.size,
    connectedUsers: userSockets.size,
  });
});

// Get active calls endpoint (for debugging/admin)
app.get("/calls", (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([roomId, callData]) => ({
    roomId,
    ...callData,
  }));
  log("info", "Active calls requested", { callCount: calls.length });
  res.status(200).json({ calls });
});

// Get user call status endpoint
app.get("/user/:userId/call-status", (req, res) => {
  const { userId } = req.params;
  const roomId = userRooms.get(userId);
  log("info", "User call status requested", { userId, roomId });

  if (!roomId) {
    return res.status(200).json({ inCall: false });
  }

  const callData = activeCalls.get(roomId);
  res.status(200).json({
    inCall: true,
    roomId,
    callData,
  });
});

const PORT = process.env.PORT || 8083;
server.listen(PORT, () => {
  log("info", "WebRTC signaling server started", { port: PORT });
});

// Graceful shutdown
process.on("SIGINT", () => {
  log("info", "Shutting down server gracefully");
  io.emit("server:shutting-down", { message: "Server is restarting, please reconnect" });
  setTimeout(() => {
    log("info", "Server shutdown complete");
    process.exit(0);
  }, 1000);
});