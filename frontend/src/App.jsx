import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import Keys from './pages/Keys';
import Accounts from './pages/Accounts';
import Transfer from './pages/Transfer';

const nav = [
  { to: '/keys', label: 'Keys' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/transfer', label: 'Transfer' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-950 text-gray-100">
        <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="px-6 py-5 border-b border-gray-800">
            <h1 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Vault + Hedera</h1>
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
    </BrowserRouter>
  );
}
