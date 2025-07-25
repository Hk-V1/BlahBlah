import { useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
  e.preventDefault();
  const endpoint = isLogin ? '/login' : '/register';

  try {
    const res = await axios.post(`https://chat-backend-xyz.onrender.com${endpoint}`, {
      username,
      password,
    });

    if (res.data.success) {
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push('/chat');
    } else {
      alert(res.data.message);
    }
  } catch (err) {
    alert('Server error');
  }
};


  return (
    <div style={{ padding: 40 }}>
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required /><br />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required /><br />
        <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
      </form>
      <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer', color: 'blue' }}>
        {isLogin ? 'New user? Register' : 'Already have an account? Login'}
      </p>
    </div>
  );
}
