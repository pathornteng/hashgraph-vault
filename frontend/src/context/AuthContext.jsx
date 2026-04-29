import { createContext, useContext, useState } from 'react';
import { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('auth_token');
    if (t) setAuthToken(t); // must run before first render so API calls have the header
    return t;
  });
  const [username, setUsername] = useState(() => localStorage.getItem('auth_username'));

  function login(jwt, user) {
    localStorage.setItem('auth_token', jwt);
    localStorage.setItem('auth_username', user);
    setToken(jwt);
    setUsername(user);
    setAuthToken(jwt);
  }

  function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    setToken(null);
    setUsername(null);
    setAuthToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
