import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import io from 'socket.io-client';

const API_BASE = 'https://blahblah-zl3k.onrender.com';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversations, setConversations] = useState({});
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [connected, setConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true); // New state for sidebar toggle
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
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      newSocket.emit('join', { token });
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setConnected(true);
      newSocket.emit('join', { token });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Get list of all users
    newSocket.on('usersList', (usersList) => {
      setUsers(usersList);
    });

    // Handle active users updates
    newSocket.on('activeUsers', (activeUsersList) => {
      setActiveUsers(activeUsersList);
      // Update online status in users list
      setUsers(prevUsers => 
        prevUsers.map(user => ({
          ...user,
          isOnline: activeUsersList.some(activeUser => activeUser.id === user.id)
        }))
      );
    });

    // Handle user coming online
    newSocket.on('userOnline', (userInfo) => {
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userInfo.id ? { ...user, isOnline: true } : user
        )
      );
    });

    // Handle user going offline
    newSocket.on('userOffline', (userInfo) => {
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userInfo.id ? { ...user, isOnline: false } : user
        )
      );
    });

    // Handle conversation messages
    newSocket.on('conversationMessages', ({ otherUserId, messages }) => {
      setConversations(prev => ({
        ...prev,
        [otherUserId]: messages
      }));
    });

    // Handle new private message
    newSocket.on('newMessage', (message) => {
      const otherUserId = message.senderId === parsedUser.id ? message.recipientId : message.senderId;
      
      setConversations(prev => ({
        ...prev,
        [otherUserId]: [...(prev[otherUserId] || []), message]
      }));

      // Add unread notification if not currently viewing this conversation
      if (!selectedUser || selectedUser.id !== otherUserId) {
        setUnreadMessages(prev => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] || 0) + 1
        }));
      }
    });

    // Handle message notifications
    newSocket.on('messageNotification', ({ from, fromId, message, timestamp }) => {
      // You could show browser notifications here
      console.log(`New message from ${from}: ${message}`);
    });

    // Handle typing indicators
    newSocket.on('userTyping', ({ userId, username, isTyping }) => {
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
  }, [conversations, selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectUser = (selectedUserInfo) => {
    if (selectedUser?.id === selectedUserInfo.id) return;

    // Leave previous conversation
    if (selectedUser && socket) {
      socket.emit('leaveConversation', { otherUserId: selectedUser.id });
    }

    setSelectedUser(selectedUserInfo);
    
    // Clear unread messages for this user
    setUnreadMessages(prev => ({
      ...prev,
      [selectedUserInfo.id]: 0
    }));

    // Join new conversation
    if (socket) {
      socket.emit('joinConversation', { otherUserId: selectedUserInfo.id });
    }

    // Auto-close sidebar on mobile after selecting a user
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket || !selectedUser) return;

    socket.emit('privateMessage', { 
      recipientId: selectedUser.id, 
      text: message.trim() 
    });
    setMessage('');
    
    // Stop typing indicator
    socket.emit('typing', { recipientId: selectedUser.id, isTyping: false });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    if (!socket || !selectedUser) return;

    // Send typing indicator
    socket.emit('typing', { recipientId: selectedUser.id, isTyping: true });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { recipientId: selectedUser.id, isTyping: false });
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

  const getCurrentMessages = () => {
    if (!selectedUser) return [];
    return conversations[selectedUser.id] || [];
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
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
            <button onClick={toggleSidebar} className="sidebar-toggle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
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
          {/* Sidebar Overlay for mobile */}
          {sidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
          )}

          {/* Contacts Sidebar */}
          <aside className={`contacts-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <h3>Contacts ({users.length})</h3>
            <div className="contacts-list">
              {users.map((contact) => (
                <div 
                  key={contact.id} 
                  className={`contact-item ${selectedUser?.id === contact.id ? 'selected' : ''}`}
                  onClick={() => selectUser(contact)}
                >
                  <div className="contact-avatar">
                    {contact.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <span className="contact-name">
                      {contact.username}
                    </span>
                    <div className="contact-status">
                      <span className={`status-indicator ${contact.isOnline ? 'online' : 'offline'}`}></span>
                      {contact.isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {unreadMessages[contact.id] > 0 && (
                    <div className="unread-badge">
                      {unreadMessages[contact.id]}
                    </div>
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <div className="no-contacts">
                  <p>No other users registered yet.</p>
                </div>
              )}
            </div>
          </aside>

          {/* Chat Messages */}
          <main className="chat-main">
            {selectedUser ? (
              <>
                <div className="chat-header-selected">
                  <div className="selected-user-info">
                    <div className="selected-user-avatar">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4>{selectedUser.username}</h4>
                      <span className={`status-text ${selectedUser.isOnline ? 'online' : 'offline'}`}>
                        {selectedUser.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="messages-container">
                  {getCurrentMessages().length === 0 ? (
                    <div className="empty-state">
                      <h3>Start chatting with {selectedUser.username}! 👋</h3>
                      <p>Send a message to begin your conversation.</p>
                    </div>
                  ) : (
                    getCurrentMessages().map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`message ${msg.senderId === user.id ? 'own-message' : 'other-message'}`}
                      >
                        <div className="message-content">
                          <div className="message-header">
                            <span className="message-username">{msg.senderUsername}</span>
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
                      placeholder={`Message ${selectedUser.username}...`}
                      disabled={!connected}
                      maxLength={500}
                    />
                    <button type="submit" disabled={!message.trim() || !connected}>
                      Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="no-chat-selected">
                <div className="no-chat-content">
                  <h3>💬 Welcome to BlahBlah!</h3>
                  <p>Select a contact from the left to start chatting</p>
                </div>
              </div>
            )}
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

          .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .sidebar-toggle {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            border-radius: 6px;
            padding: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s ease;
          }

          .sidebar-toggle:hover {
            background: rgba(255, 255, 255, 0.3);
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
            position: relative;
          }

          .sidebar-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            display: none;
          }

          .contacts-sidebar {
            width: 300px;
            background: white;
            border-right: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
            transition: transform 0.3s ease;
            z-index: 1000;
          }

          .contacts-sidebar.closed {
            transform: translateX(-100%);
          }

          .contacts-sidebar.open {
            transform: translateX(0);
          }

          .contacts-sidebar h3 {
            margin: 0;
            padding: 20px;
            color: #333;
            font-size: 1.1rem;
            border-bottom: 1px solid #e0e0e0;
          }

          .contacts-list {
            flex: 1;
            overflow-y: auto;
            padding: 10px 0;
          }

          .contact-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            cursor: pointer;
            transition: background 0.2s ease;
            position: relative;
          }

          .contact-item:hover {
            background: #f8f9fa;
          }

          .contact-item.selected {
            background: #e3f2fd;
            border-right: 3px solid #667eea;
          }

          .contact-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 1rem;
          }

          .contact-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .contact-name {
            font-size: 0.95rem;
            font-weight: 500;
            color: #333;
          }

          .contact-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            color: #666;
          }

          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }

          .status-indicator.online {
            background: #4caf50;
          }

          .status-indicator.offline {
            background: #ccc;
          }

          .unread-badge {
            background: #667eea;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: bold;
          }

          .no-contacts {
            padding: 20px;
            text-align: center;
            color: #666;
          }

          .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
          }

          .chat-header-selected {
            padding: 15px 20px;
            background: white;
            border-bottom: 1px solid #e0e0e0;
          }

          .selected-user-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .selected-user-avatar {
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

          .selected-user-info h4 {
            margin: 0;
            font-size: 1rem;
            color: #333;
          }

          .status-text {
            font-size: 0.8rem;
          }

          .status-text.online {
            color: #4caf50;
          }

          .status-text.offline {
            color: #999;
          }

          .no-chat-selected {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
          }

          .no-chat-content {
            text-align: center;
            color: #666;
          }

          .no-chat-content h3 {
            margin-bottom: 10px;
            font-size: 1.5rem;
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
            .sidebar-overlay {
              display: block;
            }

            .contacts-sidebar {
              position: absolute;
              left: 0;
              top: 0;
              height: 100%;
              box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
            }

            .chat-main {
              width: 100%;
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
