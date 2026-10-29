import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Error: ' + error.message);
      setCargando(false);
    } else {
      navigate('/admin'); // Si el login es exitoso, lo mandamos al admin
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-pink-600 mb-6">MenuFlow Admin</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Inicia sesión para gestionar tu negocio</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input 
              type="email" 
              required 
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              required 
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button 
            type="submit" 
            disabled={cargando}
            className="w-full bg-pink-600 text-white font-bold py-3 rounded-lg hover:bg-pink-700 transition disabled:bg-gray-400"
          >
            {cargando ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-gray-500 hover:text-pink-600">← Volver al menú del cliente</a>
        </div>
      </div>
    </div>
  );
}

export default Login;