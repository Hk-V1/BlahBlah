const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (use database in production)
const users = new Map();
const activeUsers = new Map();

// Create messages directory if it doesn't exist
const messagesDir = path.join(__dirname, 'messages');
if (!fs.existsSync(messagesDir)) {
  fs.mkdirSync(messagesDir);
}

// Helper functions
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Generate conversation ID for user pair (consistent ordering)
const getConversationId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_');
};

// Get messages for a conversation
const getConversationMessages = (conversationId) => {
  const filePath = path.join(messagesDir, `${conversationId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading messages:', error);
  }
  return [];
};

// Save messages for a conversation
const saveConversationMessages = (conversationId, messages) => {
  const filePath = path.join(messagesDir, `${conversationId}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('Error saving messages:', error);
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'BlahBlah Chat API is running!' });
});

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (users.has(username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    username,
    password: hashedPassword,
    createdAt: new Date()
  };
  
  users.set(username, user);
  const token = generateToken(user.id);
  
  res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const user = users.get(username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user.id);
  
  res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

// Get all users (for contact list)
app.get('/api/users', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Return all users except the current user
  const allUsers = Array.from(users.values())
    .filter(user => user.id !== decoded.userId)
    .map(user => ({ id: user.id, username: user.username }));
  
  res.json(allUsers);
});

// Get messages for a specific conversation
app.get('/api/messages/:userId', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const { userId } = req.params;
  const conversationId = getConversationId(decoded.userId, userId);
  const messages = getConversationMessages(conversationId);
  
  res.json(messages);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle user joining
  socket.on('join', (userData) => {
    const { token } = userData;
    const decoded = verifyToken(token);
    
    if (!decoded) {
      socket.emit('error', 'Invalid token');
      return;
    }
    
    // Find user by ID
    let user = null;
    for (let [username, userInfo] of users) {
      if (userInfo.id === decoded.userId) {
        user = { id: userInfo.id, username: userInfo.username };
        break;
      }
    }
    
    if (!user) {
      socket.emit('error', 'User not found');
      return;
    }
    
    // Add to active users
    activeUsers.set(socket.id, user);
    socket.userId = user.id;
    socket.username = user.username;
    
    // Join user to their own room for private messaging
    socket.join(user.id);
    
    // Send all users list (for contacts)
    const allUsers = Array.from(users.values())
      .filter(u => u.id !== user.id)
      .map(u => ({ 
        id: u.id, 
        username: u.username,
        isOnline: Array.from(activeUsers.values()).some(activeUser => activeUser.id === u.id)
      }));
    socket.emit('usersList', allUsers);
    
    // Broadcast updated active users list to all clients
    const activeUsersList = Array.from(activeUsers.values());
    io.emit('activeUsers', activeUsersList);
    
    // Notify others that user came online
    socket.broadcast.emit('userOnline', user);
  });
  
  // Handle joining a specific conversation
  socket.on('joinConversation', (data) => {
    const { otherUserId } = data;
    if (!socket.userId || !otherUserId) {
      socket.emit('error', 'Invalid conversation join request');
      return;
    }
    
    const conversationId = getConversationId(socket.userId, otherUserId);
    socket.join(conversationId);
    
    // Send conversation messages
    const messages = getConversationMessages(conversationId);
    socket.emit('conversationMessages', { otherUserId, messages });
  });
  
  // Handle leaving a conversation
  socket.on('leaveConversation', (data) => {
    const { otherUserId } = data;
    if (!socket.userId || !otherUserId) return;
    
    const conversationId = getConversationId(socket.userId, otherUserId);
    socket.leave(conversationId);
  });
  
  // Handle private message
  socket.on('privateMessage', (messageData) => {
    if (!socket.userId) {
      socket.emit('error', 'Not authenticated');
      return;
    }
    
    const { recipientId, text } = messageData;
    if (!recipientId || !text) {
      socket.emit('error', 'Invalid message data');
      return;
    }
    
    const message = {
      id: Date.now().toString(),
      text: text.trim(),
      senderId: socket.userId,
      senderUsername: socket.username,
      recipientId,
      timestamp: new Date().toISOString()
    };
    
    // Save message to file
    const conversationId = getConversationId(socket.userId, recipientId);
    const messages = getConversationMessages(conversationId);
    messages.push(message);
    
    // Keep only last 1000 messages per conversation
    if (messages.length > 1000) {
      messages.shift();
    }
    
    saveConversationMessages(conversationId, messages);
    
    // Send message to both users in the conversation
    io.to(conversationId).emit('newMessage', message);
    
    // Also send to recipient's personal room (for notifications)
    io.to(recipientId).emit('messageNotification', {
      from: socket.username,
      fromId: socket.userId,
      message: text,
      timestamp: message.timestamp
    });
  });
  
  // Handle typing indicator for specific conversation
  socket.on('typing', (data) => {
    if (!socket.username) return;
    
    const { recipientId, isTyping } = data;
    if (!recipientId) return;
    
    const conversationId = getConversationId(socket.userId, recipientId);
    socket.to(conversationId).emit('userTyping', {
      userId: socket.userId,
      username: socket.username,
      isTyping
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (activeUsers.has(socket.id)) {
      const user = activeUsers.get(socket.id);
      activeUsers.delete(socket.id);
      
      // Broadcast updated active users list
      const activeUsersList = Array.from(activeUsers.values());
      io.emit('activeUsers', activeUsersList);
      
      // Notify others that user went offline
      socket.broadcast.emit('userOffline', user);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
