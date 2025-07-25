import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import io from 'socket.io-client';

const API_BASE = 'https://blahblah-zl3k.onrender.com';
console.log('API_BASE:', API_BASE); 

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Initialize socket connection
    const newSocket = io(API_BASE, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      newSocket.emit('join', { token });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('messages', (msgs) => {
      setMessages(msgs);
    });

    newSocket.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('activeUsers', (users) => {
      setActiveUsers(users);
    });

    newSocket.on('userJoined', (user) => {
      // Optional: show notification that user joined
    });

    newSocket.on('userLeft', (user) => {
      // Optional: show notification that user left
    });

    newSocket.on('userTyping', ({ username, isTyping }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(username);
        } else {
          newSet.delete(username);
        }
        return newSet;
      });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      if (error === 'Invalid token') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    socket.emit('message', { text: message.trim() });
    setMessage('');
    
    // Stop typing indicator
    socket.emit('typing', false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    if (!socket) return;

    // Send typing indicator
    socket.emit('typing', true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, 1000);
  };

  const logout = () => {
    if (socket) {
      socket.close();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>BlahBlah Chat</title>
      </Head>

      <div className="chat-container">
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <h1>💬 BlahBlah</h1>
            <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          </div>
          <div className="header-right">
            <span className="username">Hello, {user.username}!</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </header>

        <div className="chat-body">
          {/* Active Users Sidebar */}
          <aside className="users-sidebar">
            <h3>Active Users ({activeUsers.length})</h3>
            <div className="users-list">
              {activeUsers.map((activeUser) => (
                <div 
                  key={activeUser.id} 
                  className={`user-item ${activeUser.id === user.id ? 'current-user' : ''}`}
                >
                  <div className="user-avatar">
                    {activeUser.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="user-name">
                    {activeUser.username}
                    {activeUser.id === user.id && ' (You)'}
                  </span>
                  <div className="user-status"></div>
                </div>
              ))}
            </div>
          </aside>

          {/* Chat Messages */}
          <main className="chat-main">
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <h3>Welcome to BlahBlah! 👋</h3>
                  <p>Start chatting with people around the world!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`message ${msg.userId === user.id ? 'own-message' : 'other-message'}`}
                  >
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-username">{msg.username}</span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className="message-text">{msg.text}</div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Typing indicators */}
              {typingUsers.size > 0 && (
                <div className="typing-indicator">
                  <div className="typing-content">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">
                      {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="message-input-form">
              <div className="input-container">
                <input
                  type="text"
                  value={message}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  disabled={!connected}
                  maxLength={500}
                />
                <button type="submit" disabled={!message.trim() || !connected}>
                  Send
                </button>
              </div>
            </form>
          </main>
        </div>

        <style jsx>{`
          .chat-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #f5f5f5;
          }

          .chat-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }

          .header-left h1 {
            margin: 0;
            font-size: 1.5rem;
          }

          .connection-status {
            font-size: 0.8rem;
            margin-top: 4px;
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .username {
            font-weight: 500;
          }

          .logout-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.3s ease;
          }

          .logout-btn:hover {
            background: rgba(255, 255, 255, 0.3);
          }

          .chat-body {
            flex: 1;
            display: flex;
            overflow: hidden;
          }

          .users-sidebar {
            width: 250px;
            background: white;
            border-right: 1px solid #e0e0e0;
            padding: 20px;
            overflow-y: auto;
          }

          .users-sidebar h3 {
            margin-top: 0;
            color: #333;
            font-size: 1.1rem;
            margin-bottom: 20px;
          }

          .users-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .user-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            border-radius: 8px;
            transition: background 0.2s ease;
            position: relative;
          }

          .user-item:hover {
            background: #f8f9fa;
          }

          .user-item.current-user {
            background: #e3f2fd;
          }

          .user-avatar {
            width: 35px;
            height: 35px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 0.9rem;
          }

          .user-name {
            flex: 1;
            font-size: 0.9rem;
            color: #333;
          }

          .user-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4caf50;
          }

          .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
          }

          .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
          }

          .empty-state {
            text-align: center;
            margin-top: 50px;
            color: #666;
          }

          .empty-state h3 {
            margin-bottom: 10px;
          }

          .message {
            margin-bottom: 15px;
            display: flex;
          }

          .own-message {
            justify-content: flex-end;
          }

          .other-message {
            justify-content: flex-start;
          }

          .message-content {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            position: relative;
          }

          .own-message .message-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 4px;
          }

          .other-message .message-content {
            background: #f1f3f4;
            color: #333;
            border-bottom-left-radius: 4px;
          }

          .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 0.8rem;
          }

          .own-message .message-header {
            color: rgba(255, 255, 255, 0.8);
          }

          .other-message .message-header {
            color: #666;
          }

          .message-username {
            font-weight: 600;
          }

          .message-time {
            opacity: 0.7;
            font-size: 0.75rem;
          }

          .message-text {
            word-wrap: break-word;
            line-height: 1.4;
          }

          .typing-indicator {
            margin-bottom: 15px;
            display: flex;
            justify-content: flex-start;
          }

          .typing-content {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #f1f3f4;
            border-radius: 18px;
            border-bottom-left-radius: 4px;
          }

          .typing-dots {
            display: flex;
            gap: 3px;
          }

          .typing-dots span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #666;
            animation: typing 1.4s infinite ease-in-out;
          }

          .typing-dots span:nth-child(1) {
            animation-delay: -0.32s;
          }

          .typing-dots span:nth-child(2) {
            animation-delay: -0.16s;
          }

          @keyframes typing {
            0%, 80%, 100% {
              transform: scale(0.8);
              opacity: 0.5;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }

          .typing-text {
            font-size: 0.8rem;
            color: #666;
            font-style: italic;
          }

          .message-input-form {
            padding: 20px;
            background: white;
            border-top: 1px solid #e0e0e0;
          }

          .input-container {
            display: flex;
            gap: 10px;
            align-items: center;
          }

          .input-container input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 25px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.3s ease;
          }

          .input-container input:focus {
            border-color: #667eea;
          }

          .input-container input:disabled {
            background: #f5f5f5;
            color: #999;
          }

          .input-container button {
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s ease, opacity 0.3s ease;
            min-width: 70px;
          }

          .input-container button:hover:not(:disabled) {
            transform: translateY(-1px);
          }

          .input-container button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }

          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 1.2rem;
            color: #666;
          }

          /* Mobile Responsive */
          @media (max-width: 768px) {
            .users-sidebar {
              width: 200px;
            }

            .message-content {
              max-width: 85%;
            }

            .chat-header {
              padding: 12px 15px;
            }

            .header-left h1 {
              font-size: 1.3rem;
            }

            .header-right {
              gap: 10px;
            }

            .username {
              display: none;
            }
          }

          @media (max-width: 640px) {
            .users-sidebar {
              position: absolute;
              left: -250px;
              top: 0;
              height: 100%;
              z-index: 1000;
              transition: left 0.3s ease;
              box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
            }

            .users-sidebar.open {
              left: 0;
            }

            .chat-main {
              width: 100%;
            }

            .message-content {
              max-width: 90%;
            }

            .messages-container {
              padding: 15px;
            }

            .message-input-form {
              padding: 15px;
            }
          }
        `}</style>

        <style jsx global>{`
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #f5f5f5;
          }

          ::-webkit-scrollbar {
            width: 6px;
          }

          ::-webkit-scrollbar-track {
            background: #f1f1f1;
          }

          ::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
        `}</style>
      </div>
    </>
  );
}
