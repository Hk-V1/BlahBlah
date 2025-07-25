import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

export default function Chat() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
      router.push('/');
    } else {
      setUsername(user.username);
      socket.emit('join', user.username);
    }

    socket.on('chatHistory', (history) => {
      setChat(history);
    });

    socket.on('message', (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => socket.off('message');
  }, []);

  const sendMessage = () => {
    if (message.trim() !== '') {
      socket.emit('message', { user: username, message });
      setMessage('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {username}</h2>
      <button onClick={handleLogout}>Logout</button>
      <div style={{ border: '1px solid gray', padding: 10, marginTop: 10, height: 300, overflowY: 'scroll' }}>
        {chat.map((msg, i) => (
          <p key={i}><strong>{msg.user}:</strong> {msg.message}</p>
        ))}
      </div>
      <input value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: 200 }} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
