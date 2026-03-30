import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Logo from './components/Logo';
import Keys from './pages/Keys';
import Accounts from './pages/Accounts';
import Transfer from './pages/Transfer';
import Login from './pages/Login';

const nav = [
  { to: '/keys', label: 'Keys' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/transfer', label: 'Transfer' },
];

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function Layout() {
  const { username, logout } = useAuth();
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-800 flex items-center gap-3">
          <Logo size={28} />
          <h1 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Hashgraph Vault</h1>
        </div>
        <nav className="flex-1 py-4">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-6 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-2">{username}</p>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/keys" replace />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/transfer" element={<Transfer />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
