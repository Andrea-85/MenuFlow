import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

function Admin() {
  const [seccionActiva, setSeccionActiva] = useState('reportes'); // Empezamos en reportes por defecto
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

  const [negocio, setNegocio] = useState({ nombre: "Mi Negocio", portada: "", mensajeBienvenida: "" });
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mesas, setMesas] = useState([]);
  
  // Estado para el reporte
  const [reporteHoy, setReporteHoy] = useState({ total: 0, cantidad: 0 });

  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [productoEditando, setProductoEditando] = useState(null); 
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', descripcion: '', precio: '', categoria: '', is_recommended: false, image_url: '' });
  const [nuevaMesaNumero, setNuevaMesaNumero] = useState('');

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      const { data: configData } = await supabase.from('business_config').select('*').single();
      if (configData) setNegocio({ nombre: configData.name, portada: configData.cover_url, mensajeBienvenida: configData.welcome_message });

      const { data: catsData } = await supabase.from('categories').select('*').order('id', { ascending: true });
      if (catsData) setCategorias(catsData);

      const { data: prodsData } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (prodsData) setProductos(prodsData);

      const { data: mesasData } = await supabase.from('tables').select('*').order('number', { ascending: true });
      if (mesasData) setMesas(mesasData);

      await cargarReporteDiario(); // Cargar el reporte al iniciar

      setCargando(false);
    };
    cargarDatos();
  }, []);

  // 📊 FUNCIÓN PARA CALCULAR VENTAS DE HOY
  const cargarReporteDiario = async () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    const { data } = await supabase
      .from('orders')
      .select(`id, order_items(quantity, products(price))`)
      .eq('status', 'Pagado')
      .gte('created_at', hoy.toISOString())
      .lt('created_at', manana.toISOString());

    if (data) {
      let total = 0;
      data.forEach(order => {
        order.order_items?.forEach(item => {
          total += (Number(item.products?.price) || 0) * (Number(item.quantity) || 0);
        });
      });
      setReporteHoy({ total, cantidad: data.length });
    }
  };

  const subirArchivo = async (archivo, carpeta) => {
    if (!archivo) return null;
    setSubiendo(true);
    const nombreArchivo = `${Date.now()}-${archivo.name.replace(/\s/g, '_')}`;
    const ruta = `${carpeta}/${nombreArchivo}`;
    const { error } = await supabase.storage.from('menu-images').upload(ruta, archivo);
    if (error) { alert("Error al subir la imagen: " + error.message); setSubiendo(false); return null; }
    const { data } = supabase.storage.from('menu-images').getPublicUrl(ruta);
    setSubiendo(false);
    return data.publicUrl;
  };

  const actualizarNegocio = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('business_config').update({
      name: negocio.nombre, cover_url: negocio.portada, welcome_message: negocio.mensajeBienvenida
    }).eq('id', 1);
    if (error) alert("Error al actualizar"); else alert("¡Negocio actualizado en la nube!");
  };

  const agregarCategoria = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('categories').insert([{ name: nuevaCategoria }]);
    if (error) alert("Error al crear categoría");
    else { setNuevaCategoria(''); const { data } = await supabase.from('categories').select('*'); setCategorias(data); }
  };

  const eliminarCategoria = async (id) => {
    if(!window.confirm("¿Seguro que quieres borrar esta categoría?")) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) alert("Error al eliminar"); else { const { data } = await supabase.from('categories').select('*'); setCategorias(data); }
  };

  const manejarCambioProducto = (e) => {
    const { name, value, type, checked } = e.target;
    setNuevoProducto(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    let error;
    if (productoEditando) {
      const { error: err } = await supabase.from('products').update({
        name: nuevoProducto.nombre, description: nuevoProducto.descripcion, price: nuevoProducto.precio,
        category: nuevoProducto.categoria, is_recommended: nuevoProducto.is_recommended, image_url: nuevoProducto.image_url
      }).eq('id', productoEditando.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('products').insert([{
        name: nuevoProducto.nombre, description: nuevoProducto.descripcion, price: nuevoProducto.precio,
        category: nuevoProducto.categoria, is_recommended: nuevoProducto.is_recommended, image_url: nuevoProducto.image_url
      }]);
      error = err;
    }
    if (error) alert("Error al guardar: " + error.message);
    else {
      alert(productoEditando ? "¡Producto actualizado!" : "¡Producto creado!");
      setProductoEditando(null);
      setNuevoProducto({ nombre: '', descripcion: '', precio: '', categoria: categorias[0]?.name || '', is_recommended: false, image_url: '' });
      const { data } = await supabase.from('products').select('*');
      setProductos(data);
    }
  };

  const editarProducto = (producto) => {
    setProductoEditando(producto);
    setNuevoProducto({ nombre: producto.name, descripcion: producto.description, precio: producto.price, categoria: producto.category, is_recommended: producto.is_recommended, image_url: producto.image_url });
    setSeccionActiva('productos'); 
  };

  const eliminarProducto = async (id) => {
    if(!window.confirm("¿Seguro que quieres borrar este producto?")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("Error al eliminar"); else { const { data } = await supabase.from('products').select('*'); setProductos(data); }
  };

  const agregarMesa = async (e) => {
    e.preventDefault();
    if (!nuevaMesaNumero) return;
    const { error } = await supabase.from('tables').insert([{ number: Number(nuevaMesaNumero) }]);
    if (error) alert("Error: " + error.message);
    else { setNuevaMesaNumero(''); const { data } = await supabase.from('tables').select('*').order('number', { ascending: true }); setMesas(data); }
  };

  const eliminarMesa = async (id) => {
    if(!window.confirm("¿Seguro que quieres borrar esta mesa?")) return;
    const { error } = await supabase.from('tables').delete().eq('id', id);
    if (error) alert("Error al eliminar"); else { const { data } = await supabase.from('tables').select('*').order('number', { ascending: true }); setMesas(data); }
  };

  const esActivo = (seccion) => seccionActiva === seccion;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-pink-500">MenuFlow</h1>
          <p className="text-xs text-gray-400 mt-1">Panel de Administración</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setSeccionActiva('reportes')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${esActivo('reportes') ? 'bg-pink-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>📊 Reportes</button>
          <button onClick={() => setSeccionActiva('configuracion')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${esActivo('configuracion') ? 'bg-pink-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>⚙️ Configuración</button>
          <button onClick={() => setSeccionActiva('mesas')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${esActivo('mesas') ? 'bg-pink-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>🪑 Mesas</button>
          <button onClick={() => setSeccionActiva('categorias')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${esActivo('categorias') ? 'bg-pink-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>📂 Categorías</button>
          <button onClick={() => setSeccionActiva('productos')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${esActivo('productos') ? 'bg-pink-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>🍹 Productos</button>
        </nav>
        <div className="p-4 border-t border-gray-800 space-y-3">
          <a href="/nuevo-pedido" className="block w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-300 hover:bg-gray-800 transition"> Tomar Pedido</a>
          <a href="/cocina" className="block w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-300 hover:bg-gray-800 transition">👨‍🍳 Ver Cocina</a>
          <a href="/" className="block text-center text-sm text-gray-400 hover:text-white transition">👁️ Ver Menú del Cliente</a>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} className="block w-full text-center text-sm text-red-400 hover:text-red-300 transition font-semibold"> Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {cargando && <p className="text-center text-gray-500 mt-10">Cargando datos desde la nube...</p>}

        {/* SECCIÓN: REPORTES */}
        {seccionActiva === 'reportes' && !cargando && (
          <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Reporte de Ventas de Hoy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide">Total Vendido Hoy</p>
                <p className="text-4xl font-bold text-green-600 mt-2">${reporteHoy.total.toLocaleString('es-CO')}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide">Pedidos Pagados</p>
                <p className="text-4xl font-bold text-blue-600 mt-2">{reporteHoy.cantidad}</p>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-blue-800 text-sm">
              💡 <strong>Nota:</strong> Este reporte muestra únicamente los pedidos que han sido marcados como "Pagados" en la pantalla de Cocina/Caja el día de hoy.
            </div>
          </div>
        )}

        {/* SECCIÓN: CONFIGURACIÓN */}
        {seccionActiva === 'configuracion' && !cargando && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Configuración del Negocio</h2>
            <form onSubmit={actualizarNegocio} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
                <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={negocio.nombre} onChange={(e) => setNegocio({...negocio, nombre: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto de Portada</label>
                <input type="file" accept="image/*" className="w-full p-2 border border-gray-300 rounded-lg text-sm" onChange={async (e) => { const url = await subirArchivo(e.target.files[0], 'portadas'); if (url) setNegocio({...negocio, portada: url}); }} />
                {negocio.portada && <img src={negocio.portada} alt="Preview" className="mt-2 h-32 w-full object-cover rounded-lg" />}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de Bienvenida</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={negocio.mensajeBienvenida} onChange={(e) => setNegocio({...negocio, mensajeBienvenida: e.target.value})} />
              </div>
              <button type="submit" disabled={subiendo} className="bg-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-700 transition disabled:bg-gray-400">{subiendo ? 'Procesando...' : 'Guardar Cambios en la Nube'}</button>
            </form>
          </div>
        )}

        {/* SECCIÓN: MESAS */}
        {seccionActiva === 'mesas' && !cargando && (
          <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🪑 Gestión de Mesas y Códigos QR</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <form onSubmit={agregarMesa} className="flex gap-2">
                <input type="number" required min="1" className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={nuevaMesaNumero} onChange={(e) => setNuevaMesaNumero(e.target.value)} placeholder="Número de mesa (Ej: 5)" />
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">Agregar Mesa</button>
              </form>
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-4">Mesas registradas ({mesas.length}):</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mesas.map((mesa) => {
                    const linkMesa = `${window.location.origin}/?mesa=${mesa.number}`;
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(linkMesa)}`;
                    return (
                      <div key={mesa.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col items-center relative shadow-sm">
                        <button onClick={() => eliminarMesa(mesa.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold" title="Eliminar mesa">✕</button>
                        <span className="text-xl font-bold text-gray-800 mb-2">Mesa {mesa.number}</span>
                        <span className={`text-xs px-2 py-1 rounded-full mb-3 ${mesa.status === 'Libre' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{mesa.status}</span>
                        <div className="bg-white p-2 rounded-lg border border-gray-200 mb-2">
                          <img src={qrApiUrl} alt={`QR Mesa ${mesa.number}`} className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center break-all">Link: {linkMesa}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN: CATEGORÍAS */}
        {seccionActiva === 'categorias' && !cargando && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📂 Gestión de Categorías</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <form onSubmit={agregarCategoria} className="flex gap-2">
                <input type="text" required className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} placeholder="Nueva categoría..." />
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">Agregar</button>
              </form>
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-3">Categorías actuales:</h3>
                <div className="flex flex-wrap gap-2">
                  {categorias.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <button onClick={() => eliminarCategoria(cat.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2" title="Eliminar">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN: PRODUCTOS */}
        {seccionActiva === 'productos' && !cargando && (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🍹 Gestión de Productos</h2>
            <form onSubmit={guardarProducto} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 mb-8">
              <h3 className="font-bold text-lg text-gray-900">{productoEditando ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" name="nombre" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={nuevoProducto.nombre} onChange={manejarCambioProducto} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={nuevoProducto.descripcion} onChange={manejarCambioProducto} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto del Producto</label>
                <input type="file" accept="image/*" className="w-full p-2 border border-gray-300 rounded-lg text-sm" onChange={async (e) => { const url = await subirArchivo(e.target.files[0], 'productos'); if (url) setNuevoProducto({...nuevoProducto, image_url: url}); }} />
                {nuevoProducto.image_url && <img src={nuevoProducto.image_url} alt="Preview" className="mt-2 h-32 w-32 object-cover rounded-lg border" />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input type="number" name="precio" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={nuevoProducto.precio} onChange={manejarCambioProducto} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select name="categoria" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" value={nuevoProducto.categoria} onChange={manejarCambioProducto}>
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_recommended" id="recomendado" className="w-4 h-4 text-pink-600 rounded" checked={nuevoProducto.is_recommended} onChange={manejarCambioProducto} />
                <label htmlFor="recomendado" className="text-sm font-medium text-gray-700">Marcar como Recomendado</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={subiendo} className={`flex-1 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-400 ${productoEditando ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-pink-600 hover:bg-pink-700'}`}>
                  {subiendo ? 'Subiendo foto...' : (productoEditando ? 'Actualizar Producto' : 'Guardar Producto')}
                </button>
                {productoEditando && (
                  <button type="button" onClick={() => { setProductoEditando(null); setNuevoProducto({ nombre: '', descripcion: '', precio: '', categoria: '', is_recommended: false, image_url: '' }); }} className="px-6 py-3 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400">Cancelar</button>
                )}
              </div>
            </form>
            <h3 className="font-bold text-gray-700 mb-3">Productos registrados ({productos.length}):</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {productos.length > 0 ? productos.map(p => (
                <div key={p.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <img src={p.image_url || "https://via.placeholder.com/50"} alt={p.name} className="w-12 h-12 rounded-full object-cover border" />
                    <div>
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.category} {p.is_recommended && '⭐'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-pink-600">${Number(p.price).toLocaleString('es-CO')}</span>
                    <div className="flex gap-2">
                      <button onClick={() => editarProducto(p)} className="text-blue-500 hover:text-blue-700 text-sm font-bold">Editar</button>
                      <button onClick={() => eliminarProducto(p.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">Eliminar</button>
                    </div>
                  </div>
                </div>
              )) : <p className="p-4 text-gray-500 text-center">Aún no hay productos en la nube.</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Admin;