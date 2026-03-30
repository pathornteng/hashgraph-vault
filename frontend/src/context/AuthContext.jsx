import { createContext, useContext, useState } from 'react';
import { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);

  function login(jwt, user) {
    setToken(jwt);
    setUsername(user);
    setAuthToken(jwt);
  }

  function logout() {
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
