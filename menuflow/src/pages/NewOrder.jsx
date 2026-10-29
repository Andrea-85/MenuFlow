import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

function NewOrder() {
  const navigate = useNavigate();
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: mesasData } = await supabase.from('tables').select('*').eq('status', 'Libre').order('number');
      if (mesasData) setMesas(mesasData);

      const { data: prodsData } = await supabase.from('products').select('*');
      if (prodsData) setProductos(prodsData);

      const { data: catsData } = await supabase.from('categories').select('*');
      if (catsData) setCategorias(catsData);
    };
    cargarDatos();
  }, []);

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

  // CÁLCULO BLINDADO: Busca 'price' o 'precio' por si acaso la base de datos tiene uno u otro
  const total = carrito.reduce((sum, item) => {
    const valor = item.price !== undefined ? item.price : (item.precio !== undefined ? item.precio : 0);
    const precio = Number(valor) || 0;
    const cantidad = Number(item.cantidad) || 0;
    return sum + (precio * cantidad);
  }, 0);

  const enviarPedido = async () => {
    if (!mesaSeleccionada || carrito.length === 0) return;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ table_id: mesaSeleccionada.id, order_type: 'Mesero', status: 'Pendiente' }])
      .select()
      .single();

    if (orderError) { 
      console.error("Error order:", orderError);
      alert("Error al crear pedido: " + orderError.message); 
      return; 
    }

    const itemsParaInsertar = carrito.map(item => {
      const valor = item.price !== undefined ? item.price : (item.precio !== undefined ? item.precio : 0);
      return {
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.cantidad,
        notes: ''
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(itemsParaInsertar);

    if (itemsError) { 
      console.error("Error items:", itemsError);
      alert("Error al guardar productos: " + itemsError.message); 
      return; 
    }

    await supabase.from('tables').update({ status: 'Ocupada' }).eq('id', mesaSeleccionada.id);

    alert(`¡Pedido enviado a cocina para la Mesa ${mesaSeleccionada.number}!`);
    setCarrito([]);
    setMesaSeleccionada(null);
    navigate('/admin');
  };

  // VISTA 1: SELECCIÓN DE MESA
  if (!mesaSeleccionada) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Selecciona una Mesa Libre</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mesas.map(mesa => (
              <button 
                key={mesa.id} 
                onClick={() => setMesaSeleccionada(mesa)}
                className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:border-pink-500 transition flex flex-col items-center"
              >
                <span className="text-4xl font-bold text-gray-800">{mesa.number}</span>
                <span className="text-xs text-green-600 mt-2 font-semibold">LIBRE</span>
              </button>
            ))}
            {mesas.length === 0 && <p className="text-gray-500 col-span-4 text-center">No hay mesas libres disponibles.</p>}
          </div>
          <button onClick={() => navigate('/admin')} className="mt-8 text-gray-500 hover:text-gray-800 font-semibold">← Volver al Panel</button>
        </div>
      </div>
    );
  }

  // VISTA 2: MENÚ Y CARRITO
  const productosAMostrar = categoriaActiva 
    ? productos.filter(p => p.category === categoriaActiva) 
    : productos;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Lado Izquierdo: Menú */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Menú - Mesa {mesaSeleccionada.number}</h2>
          <button onClick={() => setMesaSeleccionada(null)} className="text-sm text-gray-500 hover:text-red-500 font-semibold">Cambiar Mesa</button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button onClick={() => setCategoriaActiva(null)} className={`px-4 py-2 rounded-full whitespace-nowrap transition ${!categoriaActiva ? 'bg-pink-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}>Todos</button>
          {categorias.map(cat => (
            <button key={cat.id} onClick={() => setCategoriaActiva(cat.name)} className={`px-4 py-2 rounded-full whitespace-nowrap transition ${categoriaActiva === cat.name ? 'bg-pink-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`}>
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {productosAMostrar.map(prod => {
            const valorProd = prod.price !== undefined ? prod.price : (prod.precio !== undefined ? prod.precio : 0);
            return (
              <div key={prod.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 className="font-bold text-gray-800">{prod.name}</h3>
                <p className="text-sm text-gray-500 flex-1 mt-1">{prod.description}</p>
                <div className="flex justify-between items-center mt-4">
                  <span className="font-bold text-pink-600">${Number(valorProd).toLocaleString('es-CO')}</span>
                  <button onClick={() => agregarAlCarrito(prod)} className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-700 transition">+ Agregar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lado Derecho: Carrito */}
      <div className="w-full md:w-96 bg-white border-l border-gray-200 p-6 flex flex-col h-screen sticky top-0 shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🛒 Pedido Actual</h3>
        <div className="flex-1 overflow-y-auto space-y-3">
          {carrito.length === 0 ? (
            <p className="text-gray-400 text-center mt-10">El carrito está vacío</p>
          ) : (
            carrito.map(item => {
              const valorItem = item.price !== undefined ? item.price : (item.precio !== undefined ? item.precio : 0);
              const precioNum = Number(valorItem) || 0;
              const subtotal = precioNum * (Number(item.cantidad) || 0);
              
              return (
                <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      ${precioNum.toLocaleString('es-CO')} x {item.cantidad} = 
                      <span className="font-bold text-gray-700 ml-1">
                        ${subtotal.toLocaleString('es-CO')}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button 
                      onClick={() => quitarDelCarrito(item.id)} 
                      className="w-7 h-7 bg-gray-200 rounded-full text-gray-700 flex items-center justify-center hover:bg-gray-300 font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold w-4 text-center">{item.cantidad}</span>
                    <button 
                      onClick={() => agregarAlCarrito(item)} 
                      className="w-7 h-7 bg-pink-100 rounded-full text-pink-700 flex items-center justify-center hover:bg-pink-200 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* TOTAL CALCULADO */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex justify-between items-center text-xl font-bold mb-4 bg-pink-50 p-4 rounded-lg border border-pink-100">
            <span className="text-gray-700">Total a Pagar:</span>
            <span className="text-pink-600 text-2xl">
              ${total.toLocaleString('es-CO')}
            </span>
          </div>
          <button 
            onClick={enviarPedido} 
            disabled={carrito.length === 0 || total === 0}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-md"
          >
            Enviar a Cocina 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewOrder;