import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Client from './pages/Client';
import Admin from './pages/Admin';
import Login from './pages/Login';
import NewOrder from './pages/NewOrder';
import Kitchen from './pages/Kitchen';

// Este es el "Guardia de Seguridad" de las rutas
function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Verificando seguridad...</div>;
  
  // Si no hay sesión (no está logueado), lo manda al login
  if (!session) return <Navigate to="/login" replace />;
  
  // Si hay sesión, lo deja pasar
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Client />} />
      <Route path="/login" element={<Login />} />
      <Route path="/nuevo-pedido" element={<NewOrder />} />
      <Route path="/cocina" element={<Kitchen />} />
      {/* La ruta admin ahora está protegida */}
      <Route path="/admin" element={
        <ProtectedRoute>
          <Admin />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App;