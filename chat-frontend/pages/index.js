import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const API_BASE = 'https://blahblah-zl3k.onrender.com';
console.log('API_BASE:', API_BASE);

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/chat');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!isLogin && password.length < 4) {
      setError('Password must be at least 4 characters long');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/chat');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>BlahBlah Chat</title>
        <meta name="description" content="Real-time chat application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="auth-container">
        <div className="auth-card">
          <div className="logo">
            <h1>💬 BlahBlah</h1>
            <p>Connect and chat in real-time</p>
          </div>

          <div className="auth-tabs">
            <button 
              className={isLogin ? 'tab active' : 'tab'}
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
            >
              Login
            </button>
            <button 
              className={!isLogin ? 'tab active' : 'tab'}
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button"
                className="link-btn"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setUsername('');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                {isLogin ? 'Register here' : 'Login here'}
              </button>
            </p>
          </div>
        </div>

        <style jsx>{`
          .auth-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }

          .auth-card {
            background: white;
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
          }

          .logo h1 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 2.5rem;
            font-weight: bold;
          }

          .logo p {
            margin: 0 0 30px 0;
            color: #666;
            font-size: 1rem;
          }

          .auth-tabs {
            display: flex;
            margin-bottom: 30px;
            border-radius: 10px;
            background: #f5f5f5;
            padding: 4px;
          }

          .tab {
            flex: 1;
            padding: 12px;
            border: none;
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
            color: #666;
          }

          .tab.active {
            background: #667eea;
            color: white;
            box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
          }

          .auth-form {
            text-align: left;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group input {
            width: 100%;
            padding: 15px;
            border: 2px solid #eee;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s ease;
            box-sizing: border-box;
          }

          .form-group input:focus {
            outline: none;
            border-color: #667eea;
          }

          .error-message {
            background: #ffe6e6;
            color: #d32f2f;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            font-size: 14px;
          }

          .submit-btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
          }

          .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
          }

          .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          .auth-footer {
            margin-top: 30px;
            text-align: center;
          }

          .auth-footer p {
            color: #666;
            margin: 0;
          }

          .link-btn {
            background: none;
            border: none;
            color: #667eea;
            cursor: pointer;
            text-decoration: underline;
            font-size: inherit;
          }

          .link-btn:hover {
            color: #764ba2;
          }

          @media (max-width: 480px) {
            .auth-card {
              padding: 30px 20px;
              margin: 20px;
            }
            
            .logo h1 {
              font-size: 2rem;
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
          }
        `}</style>
      </div>
    </>
  );
}
