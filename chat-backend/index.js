const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
const messages = [];

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

// Get messages
app.get('/api/messages', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
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
    
    // Send current messages to user
    socket.emit('messages', messages);
    
    // Broadcast updated active users list
    const activeUsersList = Array.from(activeUsers.values());
    io.emit('activeUsers', activeUsersList);
    
    // Notify others that user joined
    socket.broadcast.emit('userJoined', user);
  });
  
  // Handle new message
  socket.on('message', (messageData) => {
    if (!socket.userId) {
      socket.emit('error', 'Not authenticated');
      return;
    }
    
    const message = {
      id: Date.now().toString(),
      text: messageData.text,
      username: socket.username,
      userId: socket.userId,
      timestamp: new Date().toISOString()
    };
    
    messages.push(message);
    
    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.shift();
    }
    
    // Broadcast message to all users
    io.emit('message', message);
  });
  
  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    if (!socket.username) return;
    
    socket.broadcast.emit('userTyping', {
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
      
      // Notify others that user left
      socket.broadcast.emit('userLeft', user);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
