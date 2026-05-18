import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import PorteroDashboard from './pages/PorteroDashboard';
import ResidenteDashboard from './pages/ResidenteDashboard';
import VisitanteAcceso from './pages/VisitanteAcceso';
import ChatbotUI from './components/Chatbot/ChatbotUI';
import api from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitanteMode, setVisitanteMode] = useState(false);

  // Comprobar si hay token al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        
        if (decoded.exp < currentTime) {
           handleLogout();
        } else {
           setIsAuthenticated(true);
           setRole(decoded.rol || decoded.role); // Depende del payload
           setUser(JSON.parse(userData));
        }
      } catch (err) {
        handleLogout();
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    if(data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.usuario));
    
    // Configurar estado
    setIsAuthenticated(true);
    setRole(data.usuario.rol);
    setUser(data.usuario);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setRole(null);
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Cargando plataforma...</div>;
  }

  if (visitanteMode) {
    return <VisitanteAcceso onBack={() => setVisitanteMode(false)} />;
  }

  if (!isAuthenticated) {
     return <Login onLoginSuccess={handleLoginSuccess} onVisitanteAcceso={() => setVisitanteMode(true)} />;
  }

  return (
    <div className="relative">
      {/* Botón flotante de Cerrar Sesión */}
      <button
        onClick={handleLogout}
        className="fixed bottom-6 right-6 z-[100] bg-slate-900/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-slate-700 hover:bg-red-600 transition-colors"
      >
        Cerrar Sesión
      </button>

      {/* Chatbot Global Component */}
      <ChatbotUI />

      {/* Renderizado Condicional del Dashboard según el Rol */}       
      <div className="w-full h-full">
        {role === 'superadmin' || role === 'admin' ? (
           <AdminDashboard user={user} />
        ) : role === 'porteria' || role === 'portero' ? (
           <PorteroDashboard user={user} />
        ) : (
           <ResidenteDashboard user={user} />
        )}
      </div>
    </div>
  );
}

export default App;
