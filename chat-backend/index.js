const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// --- User storage (in-memory for now)
const users = [];

// --- Ensure chats/ folder exists
const chatsDir = path.join(__dirname, 'chats');
if (!fs.existsSync(chatsDir)) {
  fs.mkdirSync(chatsDir);
}

// --- Register endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.json({ success: false, message: 'Username already exists' });
  }
  users.push({ username, password });
  res.json({ success: true, user: { username } });
});

// --- Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, user: { username } });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// --- Socket.IO communication
io.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('join', (username) => {
    const chatFile = path.join(chatsDir, `${username}.json`);
    if (fs.existsSync(chatFile)) {
      const history = JSON.parse(fs.readFileSync(chatFile, 'utf-8'));
      socket.emit('chatHistory', history);
    }
  });

  socket.on('message', (data) => {
    const { user, message } = data;
    const chatFile = path.join(chatsDir, `${user}.json`);

    let history = [];
    if (fs.existsSync(chatFile)) {
      history = JSON.parse(fs.readFileSync(chatFile, 'utf-8'));
    }

    const newMessage = {
      user,
      message,
      timestamp: new Date().toISOString()
    };

    history.push(newMessage);
    fs.writeFileSync(chatFile, JSON.stringify(history, null, 2));

    io.emit('message', newMessage); // Broadcast to all clients
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

// --- Start server
server.listen(5000, () => console.log('🚀 Backend listening on http://localhost:5000'));
