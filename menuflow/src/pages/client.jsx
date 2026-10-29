import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';

function Client() {
  const [searchParams] = useSearchParams();
  const numeroMesaQR = searchParams.get('mesa'); // Lee el ?mesa=1 de la URL

  const [cargando, setCargando] = useState(true);
  const [negocio, setNegocio] = useState({ nombre: "Cargando...", portada: "", mensajeBienvenida: "" });
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  
  // Estados para el pedido del cliente
  const [mesaEncontrada, setMesaEncontrada] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      
      const { data: configData } = await supabase.from('business_config').select('*').single();
      if (configData) setNegocio({ nombre: configData.name, portada: configData.cover_url, mensajeBienvenida: configData.welcome_message });

      const { data: catsData } = await supabase.from('categories').select('*').order('id', { ascending: true });
      if (catsData) setCategorias(catsData);

      const { data: prodsData } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (prodsData) setProductos(prodsData);

      // Si hay un QR, buscamos la mesa en la base de datos
      if (numeroMesaQR) {
        const { data: mesaData } = await supabase
          .from('tables')
          .select('*')
          .eq('number', Number(numeroMesaQR))
          .single();
        
        if (mesaData) {
          setMesaEncontrada(mesaData);
        }
      }

      setCargando(false);
    };
    cargarDatos();
  }, [numeroMesaQR]);

  // Lógica del Carrito
  const agregarAlCarrito = (producto) => {
    const existe = carrito.find(item => item.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const quitarDelCarrito = (productoId) => {
    const item = carrito.find(i => i.id === productoId);
    if (item && item.cantidad > 1) {
      setCarrito(carrito.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i));
    } else {
      setCarrito(carrito.filter(i => i.id !== productoId));
    }
  };

  const total = carrito.reduce((sum, item) => {
    const valor = item.price !== undefined ? item.price : (item.precio !== undefined ? item.precio : 0);
    return sum + ((Number(valor) || 0) * (Number(item.cantidad) || 0));
  }, 0);

  const enviarPedidoCliente = async () => {
    if (!mesaEncontrada || carrito.length === 0) return;
    setEnviando(true);

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ table_id: mesaEncontrada.id, order_type: 'Cliente', status: 'Pendiente' }])
      .select()
      .single();

    if (orderError) { alert("Error al enviar pedido"); setEnviando(false); return; }

    const itemsParaInsertar = carrito.map(item => ({
      order_id: orderData.id,
      product_id: item.id,
      quantity: item.cantidad,
      notes: ''
    }));

    await supabase.from('order_items').insert(itemsParaInsertar);
    await supabase.from('tables').update({ status: 'Ocupada' }).eq('id', mesaEncontrada.id);

    alert(`¡Pedido enviado a cocina! La mesa ${mesaEncontrada.number} ha sido ocupada.`);
    setCarrito([]);
    setEnviando(false);
  };

  const productosAMostrar = categoriaActiva 
    ? productos.filter(p => p.category === categoriaActiva) 
    : productos;

  if (cargando) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500">Cargando menú...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24">
      {/* PORTADA */}
      <div className="relative h-48 w-full">
        <img src={negocio.portada || "https://via.placeholder.com/800x400"} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
          <h1 className="text-2xl font-bold text-white">{negocio.nombre}</h1>
          <p className="text-sm text-gray-200">{negocio.mensajeBienvenida}</p>
        </div>
      </div>

      {/* BANNER DE MESA (Solo si escaneó QR) */}
      {mesaEncontrada && (
        <div className="bg-pink-600 text-white text-center py-3 font-bold shadow-md sticky top-0 z-10">
          📍 Estás ordenando desde la Mesa {mesaEncontrada.number}
        </div>
      )}

      <div className="p-4 max-w-md mx-auto">
        {categoriaActiva && (
          <button onClick={() => setCategoriaActiva(null)} className="mb-4 text-pink-600 font-bold flex items-center gap-1 hover:text-pink-800">
            ← Volver a Recomendados
          </button>
        )}

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            {categoriaActiva ? `🍹 ${categoriaActiva}` : '⭐ Recomendados'}
          </h2>
          
          <div className="space-y-4">
            {productosAMostrar.length > 0 ? (
              productosAMostrar.map(producto => {
                const valorProd = producto.price !== undefined ? producto.price : (producto.precio !== undefined ? producto.precio : 0);
                return (
                  <div key={producto.id} className="flex bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <img src={producto.image_url || "https://via.placeholder.com/150"} alt={producto.name} className="w-28 h-28 object-cover" />
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{producto.name}</h3>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{producto.description}</p>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-pink-600 font-bold text-lg">${Number(valorProd).toLocaleString('es-CO')}</span>
                        {/* Botón de agregar solo si hay mesa (QR) */}
                        {mesaEncontrada && (
                          <button onClick={() => agregarAlCarrito(producto)} className="bg-gray-900 text-white px-3 py-1 rounded-lg text-xs hover:bg-gray-700">+ Agregar</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-center py-8 bg-white rounded-xl border border-gray-100">Aún no hay productos aquí.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-900">📂 Nuestro Menú</h2>
          <div className="grid grid-cols-2 gap-3">
            {categorias.map((categoria) => {
              const estaActiva = categoriaActiva === categoria.name;
              return (
                <button key={categoria.id} onClick={() => setCategoriaActiva(categoria.name)} className={`p-4 rounded-xl shadow-sm border text-center font-semibold transition cursor-pointer ${estaActiva ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-100 hover:bg-pink-50 hover:text-pink-600'}`}>
                  {categoria.name}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* CARRITO FLOTANTE (Solo si hay mesa y productos) */}
      {mesaEncontrada && carrito.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-2xl z-20 max-w-md mx-auto right-0">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-gray-800">🛒 Tu Pedido ({carrito.length} items)</span>
            <span className="text-pink-600 font-bold text-xl">${total.toLocaleString('es-CO')}</span>
          </div>
          <button 
            onClick={enviarPedidoCliente} 
            disabled={enviando}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition"
          >
            {enviando ? 'Enviando...' : 'Enviar Pedido a Cocina 🚀'}
          </button>
        </div>
      )}
    </div>
  )
}

export default Client;