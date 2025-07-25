const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const users = [];

app.get('/', (req, res) => {
  res.send('Backend running...');
});

app.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    if (users.find(u => u.username === username)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    users.push({ username, password });
    res.json({ success: true, user: { username } });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ success: true, user: { username } });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
