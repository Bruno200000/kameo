import React, { useState } from 'react';
import '../styles/Login.css';
import { API_URL } from '../hooks/useFetch';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

const LoginPage = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');
      const payload = isJsonResponse ? await response.json() : { error: await response.text() };

      if (!response.ok) {
        setError(payload?.error || 'Erreur de connexion');
        return;
      }

      if (payload?.success) {
        onLoginSuccess(payload.user);
      } else {
        setError(payload?.error || 'Erreur de connexion');
      }
    } catch (err) {
      setError('Erreur de communication avec le serveur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <img src="/logo.png" alt="KAméo Logo" className="login-logo" />
        <h1 className="login-brand">KAméo</h1>
        <p className="login-subtitle">Simplement Efficace</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div style={{ color: '#ef4444', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
          
          <div className="form-group" style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: '#94a3b8' }} />
            <input 
              type="email" 
              className="form-input" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <div 
              style={{ position: 'absolute', right: '15px', top: '15px', cursor: 'pointer', color: '#94a3b8' }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              className="form-input" 
              placeholder="Mot de passe" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="login-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Connexion en cours...' : 'Connexion'}
          </button>

          <div className="login-footer">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: '16px', height: '16px' }} /> Se rappeler de moi
            </label>
            <a href="#">Mot de passe oublié ?</a>
          </div>
        </form>
      </div>

      <div className="login-right">
        <div className="quote-content">
          <p className="quote-text">
            "Ceux qui rêvent le jour connaissent toutes les choses qui échappent à ceux qui rêvent la nuit."
          </p>
          <p className="quote-author">Edgar Allan Poe</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
