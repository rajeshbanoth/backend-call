// // // // const express = require('express');
// // // // const http = require('http');
// // // // const { Server } = require('socket.io');

// // // // const app = express();
// // // // const server = http.createServer(app);
// // // // const io = new Server(server, {
// // // //   cors: { origin: '*' },
// // // //   pingTimeout: 60000,
// // // //   pingInterval: 25000,
// // // // });

// // // // // In-memory storage
// // // // const connectedUsers = new Map();
// // // // const activeCalls = new Map();
// // // // const pendingSignals = new Map();
// // // // const userStatus = new Map();
// // // // const callTimeouts = new Map();
// // // // const callStates = new Map(); // Enhanced call state tracking

// // // // // Utilities
// // // // function getUserSocket(userId) {
// // // //   const socket = connectedUsers.get(userId);
// // // //   console.log(`[UTIL] Getting socket for ${userId}: ${socket ? socket.id : 'not found'}`);
// // // //   return socket;
// // // // }

// // // // function getUserStatus(userId) {
// // // //   const status = userStatus.get(userId) || { status: 'available', currentCallId: null };
// // // //   console.log(`[UTIL] Getting status for ${userId}: ${status.status}, call: ${status.currentCallId}`);
// // // //   return status;
// // // // }

// // // // function setUserStatus(userId, status, currentCallId = null) {
// // // //   userStatus.set(userId, { status, currentCallId });
// // // //   console.log(`[STATUS] User ${userId} set to ${status} (call: ${currentCallId})`);
// // // // }

// // // // function queueSignal(userId, event, data) {
// // // //   if (!pendingSignals.has(userId)) pendingSignals.set(userId, []);
// // // //   pendingSignals.get(userId).push({ event, data });
// // // //   console.log(`[QUEUE] Queued ${event} for ${userId}`);
// // // // }

// // // // function deliverPendingSignals(userId, socket) {
// // // //   if (!pendingSignals.has(userId)) return;
// // // //   const signals = pendingSignals.get(userId);
// // // //   signals.forEach(({ event, data }) => {
// // // //     console.log(`[DELIVER] Delivering pending ${event} to ${userId}`);
// // // //     socket.emit(event, data);
// // // //   });
// // // //   pendingSignals.delete(userId);
// // // // }

// // // // function clearCallTimeout(callId) {
// // // //   if (callTimeouts.has(callId)) {
// // // //     clearTimeout(callTimeouts.get(callId));
// // // //     callTimeouts.delete(callId);
// // // //     console.log(`[TIMEOUT] Cleared timeout for call ${callId}`);
// // // //   }
// // // // }

// // // // function setCallTimeout(callId, callback, delay) {
// // // //   clearCallTimeout(callId);
// // // //   const timeout = setTimeout(() => {
// // // //     callTimeouts.delete(callId);
// // // //     callback();
// // // //   }, delay);
// // // //   callTimeouts.set(callId, timeout);
// // // //   console.log(`[TIMEOUT] Set timeout for call ${callId} (${delay}ms)`);
// // // // }

// // // // // Socket.IO
// // // // io.on('connection', (socket) => {
// // // //   console.log(`[CONNECT] Socket connected: ${socket.id}`);

// // // //   // Register user
// // // //   socket.on('register', ({ userId }) => {
// // // //     if (!userId || typeof userId !== 'string') {
// // // //       console.warn(`[REGISTER] Invalid userId: ${userId}`);
// // // //       return socket.emit('error', { message: 'Invalid user ID' });
// // // //     }

// // // //     const existingSocket = getUserSocket(userId);
// // // //     if (existingSocket && existingSocket.id !== socket.id) {
// // // //       console.log(`[REPLACE] Replacing existing socket for ${userId}`);
// // // //       existingSocket.emit('force_disconnect', { message: 'New connection established' });
// // // //       existingSocket.disconnect();
// // // //     }

// // // //     connectedUsers.set(userId, socket);
// // // //     socket.userId = userId;
// // // //     setUserStatus(userId, 'available');

// // // //     console.log(`[REGISTERED] User ${userId} registered (socket: ${socket.id})`);
// // // //     socket.emit('registered', { success: true });

// // // //     // Update participantSockets for active calls
// // // //     for (const [callId, call] omof activeCalls.entries()) {
// // // //       if (call.participants.includes(userId) && !call.participantSockets[userId]) {
// // // //         call.participantSockets[userId] = socket;
// // // //         console.log(`[UPDATE] Added socket for ${userId} to call ${callId}`);
// // // //       }
// // // //     }

// // // //     deliverPendingSignals(userId, socket);
// // // //   });

// // // //   // Update user status
// // // //   socket.on('user_status', ({ userId, status }) => {
// // // //     if (userId && socket.userId === userId) setUserStatus(userId, status);
// // // //   });

// // // //   // Initiate call
// // // //   socket.on('call_initiate', (data) => {
// // // //     const { callId, callerId, receiverIds, callType, extraMeta } = data;
// // // //     if (!callId || !callerId || !receiverIds || receiverIds.length === 0) {
// // // //       console.warn(`[CALL INIT] Missing data`, data);
// // // //       return socket.emit('error', { message: 'Invalid call data' });
// // // //     }

// // // //     const callerSocket = getUserSocket(callerId);
// // // //     if (!callerSocket) {
// // // //       console.warn(`[CALL INIT] Caller ${callerId} not connected`);
// // // //       return socket.emit('error', { message: 'Caller not connected' });
// // // //     }

// // // //     const receiverId = receiverIds[0];
// // // //     const receiverStatus = getUserStatus(receiverId);
// // // //     if (receiverStatus.status === 'busy') {
// // // //       console.log(`[CALL BUSY] Receiver ${receiverId} is busy`);
// // // //       return callerSocket.emit('call_busy', { callId, receiverId });
// // // //     }

// // // //     // Clear any stale call state
// // // //     if (activeCalls.has(callId)) {
// // // //       console.warn(`[CALL INIT] Overwriting stale call ${callId}`);
// // // //       activeCalls.delete(callId);
// // // //     }

// // // //     // Create call entry
// // // //     activeCalls.set(callId, {
// // // //       callId,
// // // //       callerId,
// // // //       receiverIds,
// // // //       callType,
// // // //       participants: [callerId, receiverId],
// // // //       participantSockets: { [callerId]: callerSocket },
// // // //       status: 'initiated',
// // // //       extraMeta,
// // // //     });

// // // //     // Initialize call state machine
// // // //     callStates.set(callId, {
// // // //       status: 'initiated',
// // // //       callerId,
// // // //       receiverId,
// // // //       offerAttempts: 0,
// // // //       lastOfferTime: Date.now(),
// // // //       iceCandidates: { [callerId]: [], [receiverId]: [] }
// // // //     });

// // // //     console.log(`[CALL INIT] Created call ${callId} with participants: ${[callerId, receiverId].join(', ')}`);

// // // //     setUserStatus(callerId, 'busy', callId);

// // // //     // Timeout if no answer in 60s
// // // //     setCallTimeout(callId, () => {
// // // //       const call = activeCalls.get(callId);
// // // //       if (call && call.status === 'initiated') {
// // // //         console.log(`[CALL TIMEOUT] Call ${callId} no answer`);
// // // //         callerSocket.emit('call_timeout', { callId, reason: 'No answer' });
// // // //         Object.values(call.participantSockets).forEach(sock => {
// // // //           if (sock) sock.emit('call_ended', { callId, userId: 'system', reason: 'Timeout' });
// // // //         });
// // // //         activeCalls.delete(callId);
// // // //         callStates.delete(callId);
// // // //         setUserStatus(callerId, 'available');
// // // //         setUserStatus(receiverId, 'available');
// // // //       }
// // // //     }, 60000);

// // // //     // Send incoming call to receiver
// // // //     const receiverSocket = getUserSocket(receiverId);
// // // //     if (receiverSocket) {
// // // //       setUserStatus(receiverId, 'ringing', callId);
// // // //       receiverSocket.emit('incoming_call', data);

// // // //       // Notify caller that receiver is ringing
// // // //       callerSocket.emit('call_ringing', { callId, receiverId });

// // // //       console.log(`[CALL] Incoming call sent to ${receiverId} (callId: ${callId})`);
// // // //     } else {
// // // //       console.warn(`[CALL] Receiver ${receiverId} not connected, queuing signal`);
// // // //       queueSignal(receiverId, 'incoming_call', data);
// // // //     }
// // // //   });

// // // //   // Accept call
// // // //   socket.on('call_accept', ({ callId, receiverId }) => {
// // // //     const call = activeCalls.get(callId);
// // // //     if (!call) {
// // // //       console.warn(`[CALL ACCEPT] Call ${callId} not found`);
// // // //       return socket.emit('error', { message: 'Call not found' });
// // // //     }

// // // //     const receiverSocket = getUserSocket(receiverId);
// // // //     if (!receiverSocket) {
// // // //       console.warn(`[CALL ACCEPT] Receiver ${receiverId} not connected`);
// // // //       return socket.emit('error', { message: 'Receiver not connected' });
// // // //     }

// // // //     if (!call.participants.includes(receiverId)) {
// // // //       console.warn(`[CALL ACCEPT] Receiver ${receiverId} not in call participants`, call.participants);
// // // //       return socket.emit('error', { message: 'Invalid receiver' });
// // // //     }

// // // //     clearCallTimeout(callId);
// // // //     call.participantSockets[receiverId] = receiverSocket;
// // // //     call.status = 'active';
// // // //     setUserStatus(receiverId, 'in-call', callId);
// // // //     setUserStatus(call.callerId, 'in-call', callId);

// // // //     // Update call state
// // // //     const callState = callStates.get(callId);
// // // //     if (callState) {
// // // //       callState.status = 'active';
// // // //     }

// // // //     // Notify participants
// // // //     Object.entries(call.participantSockets).forEach(([uid, sock]) => {
// // // //       if (sock && uid !== receiverId) {
// // // //         sock.emit('call_accepted', { callId, receiverId });
// // // //         console.log(`[CALL] Notified ${uid} of acceptance by ${receiverId} (call: ${callId})`);
// // // //       }
// // // //     });

// // // //     // Signal start
// // // //     Object.values(call.participantSockets).forEach(sock => {
// // // //       if (sock) {
// // // //         sock.emit('start_signaling', { callId });
// // // //         console.log(`[SIGNAL] Emitted start_signaling to ${sock.userId} for call ${callId}`);
// // // //       }
// // // //     });
// // // //     console.log(`[SIGNAL] start_signaling emitted for call ${callId}`);
// // // //   });

// // // //   // Reject call
// // // //   socket.on('call_reject', ({ callId, userId }) => {
// // // //     const call = activeCalls.get(callId);
// // // //     if (!call) {
// // // //       console.warn(`[CALL REJECT] Call ${callId} not found`);
// // // //       return;
// // // //     }

// // // //     clearCallTimeout(callId);
// // // //     setUserStatus(call.callerId, 'available');
// // // //     setUserStatus(userId, 'available');

// // // //     const callerSocket = getUserSocket(call.callerId);
// // // //     callerSocket?.emit('call_rejected', { callId, userId });
// // // //     console.log(`[CALL] ${userId} rejected call ${callId}`);

// // // //     activeCalls.delete(callId);
// // // //     callStates.delete(callId);
// // // //   });

// // // //   // WebRTC signaling
// // // //   socket.on('webrtc_offer', ({ callId, from, to, sdp }) => {
// // // //     console.log(`[SIGNAL] OFFER from ${from} to ${to} (call ${callId})`);
// // // //     const call = activeCalls.get(callId);
// // // //     const callState = callStates.get(callId);

// // // //     if (!call || !callState) {
// // // //       console.warn(`[SIGNAL] Offer for unknown call ${callId}`);
// // // //       queueSignal(to, 'webrtc_offer', { callId, from, sdp });
// // // //       return;
// // // //     }

// // // //     // Track offer attempts for retry logic
// // // //     callState.offerAttempts += 1;
// // // //     callState.lastOfferTime = Date.now();

// // // //     if (from === to) {
// // // //       console.warn(`[SIGNAL] Offer loopback detected, from=${from}, to=${to}`);
// // // //       return;
// // // //     }

// // // //     const targetSocket = call.participantSockets[to] || getUserSocket(to);
// // // //     if (targetSocket && targetSocket.userId === to) {
// // // //       targetSocket.emit('webrtc_offer', { callId, from, sdp });
// // // //       console.log(`[SIGNAL] Forwarded offer to ${to} (socket: ${targetSocket.id})`);
// // // //     } else {
// // // //       console.warn(`[SIGNAL] No socket for ${to}, queuing offer`);
// // // //       queueSignal(to, 'webrtc_offer', { callId, from, sdp });
// // // //     }
// // // //   });

// // // //   socket.on('webrtc_answer', ({ callId, from, to, sdp }) => {
// // // //     console.log(`[SIGNAL] ANSWER from ${from} to ${to} (call ${callId})`);
// // // //     const call = activeCalls.get(callId);
// // // //     const callState = callStates.get(callId);

// // // //     if (!call || !callState) {
// // // //       console.warn(`[SIGNAL] Answer for unknown call ${callId}`);
// // // //       queueSignal(to, 'webrtc_answer', { callId, from, sdp });
// // // //       return;
// // // //     }

// // // //     // Reset offer attempts on successful answer
// // // //     callState.offerAttempts = 0;

// // // //     const targetSocket = call.participantSockets[to] || getUserSocket(to);
// // // //     if (targetSocket && targetSocket.userId === to) {
// // // //       targetSocket.emit('webrtc_answer', { callId, from, sdp });
// // // //       console.log(`[SIGNAL] Forwarded answer to ${to} (socket: ${targetSocket.id})`);
// // // //     } else {
// // // //       console.warn(`[SIGNAL] No socket for ${to}, queuing answer`);
// // // //       queueSignal(to, 'webrtc_answer', { callId, from, sdp });
// // // //     }
// // // //   });

// // // //   socket.on('ice_candidate', ({ callId, from, to, candidate }) => {
// // // //     console.log(`[SIGNAL] ICE from ${from} to ${to} (call ${callId})`);
// // // //     const call = activeCalls.get(callId);
// // // //     const callState = callStates.get(callId);

// // // //     if (!call || !callState) {
// // // //       console.warn(`[SIGNAL] ICE candidate for unknown call ${callId}`);
// // // //       // Queue for later delivery if call might be established soon
// // // //       queueSignal(to, 'ice_candidate', { callId, from, candidate });
// // // //       return;
// // // //     }

// // // //     // Store candidate for potential retransmission
// // // //     if (callState.iceCandidates[to]) {
// // // //       callState.iceCandidates[to].push({ from, candidate, timestamp: Date.now() });
// // // //     }

// // // //     const targetSocket = call.participantSockets[to] || getUserSocket(to);
// // // //     if (targetSocket && targetSocket.userId === to) {
// // // //       targetSocket.emit('ice_candidate', { callId, from, candidate });
// // // //       console.log(`[SIGNAL] Forwarded ICE candidate to ${to} (socket: ${targetSocket.id})`);
// // // //     } else {
// // // //       console.warn(`[SIGNAL] No socket for ${to}, queuing ICE candidate`);
// // // //       queueSignal(to, 'ice_candidate', { callId, from, to, candidate });
// // // //     }
// // // //   });

// // // // // Add this to your server code - replace the existing call_end handler
// // // // socket.on('call_end', ({ callId, userId }) => {
// // // //   if (!userId || typeof userId !== 'string') {
// // // //     console.warn(`[CALL END] Invalid userId: ${userId}`);
// // // //     return;
// // // //   }

// // // //   const call = activeCalls.get(callId);
// // // //   if (!call) {
// // // //     console.warn(`[CALL END] Call ${callId} not found`);
// // // //     return;
// // // //   }

// // // //   console.log(`[CALL END] User ${userId} ending call ${callId}`);

// // // //   clearCallTimeout(callId);
// // // //   setUserStatus(userId, 'available');

// // // //   // Notify all other participants
// // // //   Object.entries(call.participantSockets).forEach(([uid, sock]) => {
// // // //     if (sock && uid !== userId) {
// // // //       sock.emit('call_ended', {
// // // //         callId,
// // // //         userId,
// // // //         reason: 'User ended the call'
// // // //       });
// // // //       console.log(`[CALL] Notified ${uid} of call end by ${userId}`);
// // // //     }
// // // //   });

// // // //   // Remove user from call participants
// // // //   call.participants = call.participants.filter(id => id !== userId);
// // // //   delete call.participantSockets[userId];

// // // //   console.log(`[CALL] ${userId} ended call ${callId}`);

// // // //   // Clean up if no participants left
// // // //   if (call.participants.length === 0) {
// // // //     activeCalls.delete(callId);
// // // //     callStates.delete(callId);
// // // //     console.log(`[CALL] Call ${callId} deleted (no participants left)`);
// // // //   }
// // // // });

// // // // // Add this new event handler for user ready notification
// // // // socket.on('user_ready', ({ callId, userId }) => {
// // // //   console.log(`[USER READY] User ${userId} ready for call ${callId}`);
// // // //   const call = activeCalls.get(callId);

// // // //   if (!call) {
// // // //     console.warn(`[USER READY] Call ${callId} not found`);
// // // //     return;
// // // //   }

// // // //   // Update participant socket
// // // //   const userSocket = getUserSocket(userId);
// // // //   if (userSocket) {
// // // //     call.participantSockets[userId] = userSocket;
// // // //     console.log(`[USER READY] Updated socket for ${userId} in call ${callId}`);
// // // //   }

// // // //   // If both users are ready, start signaling
// // // //   const allReady = call.participants.every(pid => call.participantSockets[pid]);
// // // //   if (allReady) {
// // // //     console.log(`[CALL READY] All participants ready for call ${callId}`);
// // // //     Object.values(call.participantSockets).forEach(sock => {
// // // //       if (sock) {
// // // //         sock.emit('start_signaling', { callId });
// // // //         console.log(`[SIGNAL] Emitted start_signaling to ${sock.userId}`);
// // // //       }
// // // //     });
// // // //   }
// // // // });
// // // //   // Disconnect
// // // //   socket.on('disconnect', (reason) => {
// // // //     const userId = socket.userId || 'unknown';
// // // //     connectedUsers.delete(userId);
// // // //     console.log(`[DISCONNECT] ${userId} disconnected (reason: ${reason})`);

// // // //     for (const [callId, call] of activeCalls.entries()) {
// // // //       if (call.participants.includes(userId)) {
// // // //         call.participants = call.participants.filter(id => id !== userId);
// // // //         delete call.participantSockets[userId];
// // // //         Object.values(call.participantSockets).forEach(sock => {
// // // //           if (sock) {
// // // //             sock.emit('call_ended', { callId, userId, reason: 'Participant disconnected' });
// // // //             console.log(`[CALL] Notified ${sock.userId} of ${userId} disconnect from call ${callId}`);
// // // //           }
// // // //         });
// // // //         setUserStatus(userId, 'offline');
// // // //         console.log(`[CALL] Notified participants ${userId} disconnected from call ${callId}`);

// // // //         if (call.participants.length === 0) {
// // // //           activeCalls.delete(callId);
// // // //           callStates.delete(callId);
// // // //           console.log(`[CALL] Call ${callId} deleted (no participants left)`);
// // // //         }
// // // //       }
// // // //     }
// // // //   });

// // // //   socket.on('error', (err) => console.error('[SOCKET ERROR]', err));
// // // // });

// // // // // Call state monitoring for timeouts
// // // // setInterval(() => {
// // // //   const now = Date.now();
// // // //   for (const [callId, callState] of callStates.entries()) {
// // // //     const call = activeCalls.get(callId);

// // // //     // Check for offer timeouts (no answer within 10s)
// // // //     if (callState.status === 'initiated' &&
// // // //         callState.offerAttempts > 0 &&
// // // //         now - callState.lastOfferTime > 10000) {

// // // //       console.log(`[TIMEOUT] Call ${callId} offer timeout`);
// // // //       const callerSocket = getUserSocket(callState.callerId);
// // // //       if (callerSocket) {
// // // //         callerSocket.emit('call_timeout', {
// // // //           callId,
// // // //           reason: 'No answer from receiver'
// // // //         });
// // // //       }

// // // //       // Clean up
// // // //       activeCalls.delete(callId);
// // // //       callStates.delete(callId);
// // // //       setUserStatus(callState.callerId, 'available');
// // // //       setUserStatus(callState.receiverId, 'available');
// // // //     }

// // // //     // Clean up old ICE candidates (older than 1 minute)
// // // //     for (const userId in callState.iceCandidates) {
// // // //       callState.iceCandidates[userId] = callState.iceCandidates[userId].filter(
// // // //         c => now - c.timestamp < 60000
// // // //       );
// // // //     }
// // // //   }
// // // // }, 5000); // Run every 5 seconds

// // // // // Health check
// // // // app.get('/health', (_, res) => {
// // // //   res.json({
// // // //     status: 'OK',
// // // //     connectedUsers: Array.from(connectedUsers.keys()),
// // // //     activeCalls: Array.from(activeCalls.entries()).map(([callId, call]) => ({
// // // //       callId,
// // // //       participants: call.participants,
// // // //       status: call.status,
// // // //       participantSockets: Object.keys(call.participantSockets),
// // // //     })),
// // // //     userStatus: Object.fromEntries(userStatus),
// // // //   });
// // // // });

// // // // app.get('/', (_, res) => res.send('WebRTC Signaling Server running'));
// // // // server.listen(8083, () => console.log('[SERVER] Listening on port 8083'));
// // // // server.js

// // const express = require('express');
// // const http = require('http');
// // const socketIo = require('socket.io');

// // const app = express();
// // const server = http.createServer(app);
// // const io = socketIo(server);

// // const PORT = process.env.PORT || 3000;

// // io.on('connection', (socket) => {
// //     console.log('A user connected:', socket.id);

// //     // Event for when a user joins a room
// //     socket.on('join-room', (roomId) => {
// //         socket.join(roomId);
// //         console.log(`User ${socket.id} joined room ${roomId}`);
// //         // Notify other users in the room that a new user has joined
// //         socket.to(roomId).emit('user-joined', socket.id);
// //     });

// //     // Relay the offer from one peer to another
// //     socket.on('offer', (data) => {
// //         socket.to(data.roomId).emit('offer', {
// //             id: socket.id,
// //             offer: data.offer
// //         });
// //     });

// //     // Relay the answer from one peer to another
// //     socket.on('answer', (data) => {
// //         socket.to(data.roomId).emit('answer', {
// //             id: socket.id,
// //             answer: data.answer
// //         });
// //     });

// //     // Relay ICE candidates
// //     socket.on('ice-candidate', (data) => {
// //         socket.to(data.roomId).emit('ice-candidate', {
// //             id: socket.id,
// //             candidate: data.candidate
// //         });
// //     });

// //     // Handle disconnection
// //     socket.on('disconnect', () => {
// //         console.log('A user disconnected:', socket.id);
// //     });
// // });

// // server.listen(PORT, () => {
// //     console.log(`Server is running on http://localhost:${PORT}`);
// // });

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 8083;

// Store room data
const rooms = new Map();
const connectedUsers = new Map(); // Store userId -> socketId mapping
const MAX_PARTICIPANTS_PER_ROOM = 2; // Set your desired limit

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Room info endpoint
app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json({
    roomId,
    participants: room.participants.size,
    maxParticipants: MAX_PARTICIPANTS_PER_ROOM,
    createdAt: room.createdAt,
  });
});

// Clean up empty rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.size === 0 && now - room.lastActivity > 300000) {
      // 5 minutes
      console.log(`Cleaning up empty room: ${roomId}`);
      rooms.delete(roomId);
    }
  }
}, 60000); // Check every minute

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Event for when a user joins a room
  socket.on("join-room", (roomId) => {
    try {
      // Validate room ID
      if (!roomId || typeof roomId !== "string") {
        socket.emit("error", { message: "Invalid room ID" });
        return;
      }

      // Get or create room
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          participants: new Map(),
          createdAt: Date.now(),
          lastActivity: Date.now(),
        });
      }

      const room = rooms.get(roomId);

      // Check if room is full
      if (room.participants.size >= MAX_PARTICIPANTS_PER_ROOM) {
        socket.emit("room-full", { roomId });
        console.log(`Room ${roomId} is full. User ${socket.id} cannot join.`);
        return;
      }

      // Join the room
      socket.join(roomId);

      // Store user info
      const userInfo = {
        id: socket.id,
        joinedAt: Date.now(),
        roomId,
      };

      room.participants.set(socket.id, userInfo);
      room.lastActivity = Date.now();

      console.log(
        `User ${socket.id} joined room ${roomId}. Participants: ${room.participants.size}`
      );

      // Notify the user about successful join
      socket.emit("joined-room", {
        roomId,
        userId: socket.id,
        participants: room.participants.size,
      });

      // Notify other users in the room that a new user has joined
      socket.to(roomId).emit("user-joined", {
        userId: socket.id,
        participants: room.participants.size,
      });

      // Send current participants list to the new user
      const participantsList = Array.from(room.participants.values()).filter(
        (user) => user.id !== socket.id
      );

      if (participantsList.length > 0) {
        socket.emit("participants-list", { participants: participantsList });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Relay the offer from one peer to a specific peer
  socket.on("offer", (data) => {
    try {
      const { offer, roomId, targetUserId } = data;

      if (!roomId || !offer || !targetUserId) {
        socket.emit("error", { message: "Invalid offer data" });
        return;
      }

      const room = rooms.get(roomId);
      if (!room || !room.participants.has(socket.id)) {
        socket.emit("error", { message: "Not in room" });
        return;
      }

      console.log(`Relaying offer from ${socket.id} to user ${targetUserId}`);

      // Send to the specific target user
      socket.to(targetUserId).emit("offer", {
        offer,
        fromUserId: socket.id,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
      socket.emit("error", { message: "Failed to process offer" });
    }
  });

  // Relay the answer from one peer to a specific peer
  socket.on("answer", (data) => {
    try {
      const { answer, roomId, targetUserId } = data;

      if (!roomId || !answer || !targetUserId) {
        socket.emit("error", { message: "Invalid answer data" });
        return;
      }

      const room = rooms.get(roomId);
      if (!room || !room.participants.has(socket.id)) {
        socket.emit("error", { message: "Not in room" });
        return;
      }

      console.log(`Relaying answer from ${socket.id} to user ${targetUserId}`);

      // Send to the specific target user
      socket.to(targetUserId).emit("answer", {
        answer,
        fromUserId: socket.id,
      });
    } catch (error) {
      console.error("Error handling answer:", error);
      socket.emit("error", { message: "Failed to process answer" });
    }
  });

  // Relay ICE candidates to specific user
  socket.on("ice-candidate", (data) => {
    try {
      const { candidate, roomId, targetUserId } = data;

      if (!roomId || !candidate || !targetUserId) {
        socket.emit("error", { message: "Invalid ICE candidate data" });
        return;
      }

      const room = rooms.get(roomId);
      if (!room || !room.participants.has(socket.id)) {
        socket.emit("error", { message: "Not in room" });
        return;
      }

      console.log(
        `Relaying ICE candidate from ${socket.id} to user ${targetUserId}`
      );

      // Send to the specific target user
      socket.to(targetUserId).emit("ice-candidate", {
        candidate,
        fromUserId: socket.id,
      });
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
      socket.emit("error", { message: "Failed to process ICE candidate" });
    }
  });

  // Handle user leaving room
  socket.on("leave-room", (roomId) => {
    try {
      const room = rooms.get(roomId);
      if (room && room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        room.lastActivity = Date.now();

        socket.leave(roomId);

        console.log(
          `User ${socket.id} left room ${roomId}. Remaining participants: ${room.participants.size}`
        );

        // Notify other users in the room
        socket.to(roomId).emit("user-left", {
          userId: socket.id,
          participants: room.participants.size,
        });

        // Clean up empty room after delay
        if (room.participants.size === 0) {
          setTimeout(() => {
            if (rooms.get(roomId)?.participants.size === 0) {
              console.log(`Removing empty room: ${roomId}`);
              rooms.delete(roomId);
            }
          }, 30000); // 30 second delay
        }
      }
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  // Register userId
  socket.on("register", ({ userId }) => {
    connectedUsers.set(userId, socket.id);
    console.log(`User registered: ${userId}`);
  });

  socket.on("call_user", ({ callerId, calleeId, roomId }) => {
    const calleeSocketId = connectedUsers.get(calleeId);

    if (calleeSocketId) {
      console.log(`Calling ${calleeId} from ${callerId}, Room ID: ${roomId}`);

      io.to(calleeSocketId).emit("incoming_call", {
        callerId,
        calleeId,
        roomId,
      });
    } else {
      console.log(`Callee ${calleeId} not connected, sending busy`);
      socket.emit("call_busy");
    }
  });

  // Callee accepts call
  socket.on("accept_call", (callData) => {
    console.log(callData, "logging  acceptCall");
    const callerSocketId = connectedUsers.get(callData.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_accepted", callData);
    }
  });

  // Callee rejects call
  socket.on("reject_call", (callData) => {
    const callerSocketId = connectedUsers.get(callData.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_rejected");
    }
  });

  socket.on("call_ringing",(callData)=>{

    console.log(callData, "logging  call_ringing");
    const callerSocketId = connectedUsers.get(callData.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("ringing");
    }
  })
  // Handle call end
  socket.on("end_call", ({ userId }) => {
    const otherUserSocketId = [...connectedUsers.entries()].find(
      ([_, sId]) => sId !== socket.id
    )?.[1];

    if (otherUserSocketId) {
      io.to(otherUserSocketId).emit("call_ended");
    }
  });

  // Handle ping/pong for connection health
  socket.on("ping", () => {
    socket.emit("pong");
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`User ${socket.id} disconnected. Reason: ${reason}`);

    // Remove user from all rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        room.lastActivity = Date.now();

        console.log(
          `User ${socket.id} removed from room ${roomId} due to disconnect`
        );

        // Notify other users in the room
        socket.to(roomId).emit("user-left", {
          userId: socket.id,
          participants: room.participants.size,
          reason: "disconnected",
        });

        // Clean up empty room after delay
        if (room.participants.size === 0) {
          setTimeout(() => {
            if (rooms.get(roomId)?.participants.size === 0) {
              console.log(`Removing empty room: ${roomId}`);
              rooms.delete(roomId);
            }
          }, 30000);
        }
      }
    }

    for (const [userId, sId] of connectedUsers.entries()) {
      if (sId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User disconnected: ${userId}`);
        break;
      }
    }
  });

  // Error handling
  socket.on("error", (error) => {
    console.error(`Socket error for user ${socket.id}:`, error);
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");

  // Notify all clients
  io.emit("server-shutdown", { message: "Server is shutting down" });

  setTimeout(() => {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  }, 1000);
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

module.exports = { app, server, io };
// server.js (updated full code)
