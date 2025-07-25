const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let users = [];  // In-memory user storage
let messages = {}; // Store chat messages by username

// REGISTER
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (users.find(u => u.username === username)) {
    return res.json({ success: false, message: 'Username already exists' });
  }

  users.push({ username, password });
  messages[username] = [];
  return res.json({ success: true, user: { username } });
});

// LOGIN
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }

  return res.json({ success: true, user: { username } });
});

// SAVE MESSAGE
app.post('/message', (req, res) => {
  const { username, message } = req.body;

  if (!messages[username]) {
    messages[username] = [];
  }

  messages[username].push({ text: message, timestamp: Date.now() });
  res.json({ success: true });
});

// GET MESSAGES
app.get('/messages/:username', (req, res) => {
  const { username } = req.params;

  if (!messages[username]) {
    return res.json({ messages: [] });
  }

  res.json({ messages: messages[username] });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
