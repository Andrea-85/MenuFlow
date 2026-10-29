import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

function Kitchen() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  //  Estado para guardar el dinero que entrega el cliente en cada mesa
  const [montoRecibido, setMontoRecibido] = useState({});

  useEffect(() => {
    cargarPedidos();

    const subscription = supabase
      .channel('pedidos-cocina')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        cargarPedidos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const cargarPedidos = async () => {
    setCargando(true);
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        tables (number),
        order_items (
          *,
          products (name, price)
        )
      `)
      .in('status', ['Pendiente', 'Preparando', 'Listo'])
      .order('created_at', { ascending: true });

    if (error) console.error('Error cargando pedidos:', error);
    else setPedidos(data || []);
    
    setCargando(false);
  };

  const cambiarEstado = async (orderId, nuevoEstado) => {
    const { error } = await supabase.from('orders').update({ status: nuevoEstado }).eq('id', orderId);
    if (error) alert('Error al actualizar');
  };

  const liberarMesa = async (orderId, tableId) => {
    if (!window.confirm('¿Confirmar pago y liberar la mesa?')) return;

    await supabase.from('orders').update({ status: 'Pagado' }).eq('id', orderId);
    await supabase.from('tables').update({ status: 'Libre' }).eq('id', tableId);
    
    // Limpiar el input de esta mesa
    setMontoRecibido(prev => {
      const nuevo = {...prev};
      delete nuevo[orderId];
      return nuevo;
    });
    
    cargarPedidos();
  };

  const getEstadoColor = (estado) => {
    switch(estado) {
      case 'Pendiente': return 'bg-red-100 border-red-500 text-red-800';
      case 'Preparando': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'Listo': return 'bg-green-100 border-green-500 text-green-800';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">👨‍🍳 Cocina / Barra / Caja</h1>
            <p className="text-gray-500">Gestión de pedidos y cobros</p>
          </div>
          <button onClick={() => navigate('/admin')} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            ← Volver al Admin
          </button>
        </div>

        {cargando ? (
          <p className="text-center text-gray-500 mt-10">Cargando pedidos...</p>
        ) : pedidos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
            <p className="text-gray-400 text-lg">No hay pedidos pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pedidos.map(pedido => {
              const totalPedido = pedido.order_items?.reduce((sum, item) => {
                const precio = Number(item.products?.price) || 0;
                const cantidad = Number(item.quantity) || 0;
                return sum + (precio * cantidad);
              }, 0) || 0;

              // 🧮 Lógica de la calculadora de cambio
              const recibido = Number(montoRecibido[pedido.id] || 0);
              const cambio = recibido - totalPedido;
              const esSuficiente = recibido >= totalPedido && recibido > 0;

              return (
                <div key={pedido.id} className={`bg-white rounded-xl shadow-md border-l-8 p-6 ${getEstadoColor(pedido.status)} flex flex-col`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">Mesa {pedido.tables?.number}</h3>
                      <p className="text-sm opacity-75">
                        {new Date(pedido.created_at).toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white bg-opacity-50">
                      {pedido.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 mb-6 flex-1">
                    {pedido.order_items?.map((item, idx) => {
                      const subtotal = (Number(item.products?.price) || 0) * (Number(item.quantity) || 0);
                      return (
                        <div key={idx} className="flex justify-between items-start border-b border-gray-200 pb-2">
                          <div>
                            <span className="font-bold text-lg">{item.quantity}x</span>
                            <span className="ml-2 text-gray-700">{item.products?.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-gray-600">${subtotal.toLocaleString('es-CO')}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-200">
                    
                    {/* 💰 SECCIÓN DE COBRO Y CAMBIO */}
                    {pedido.status === 'Listo' && (
                      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mb-4 space-y-3">
                        <p className="text-sm text-blue-800 font-semibold uppercase text-center">Total a Pagar</p>
                        <p className="text-3xl font-bold text-blue-900 text-center">
                          ${totalPedido.toLocaleString('es-CO')}
                        </p>
                        
                        <div className="mt-3">
                          <label className="block text-xs text-gray-600 mb-1 font-semibold">¿Con cuánto billete le pagan?</label>
                          <input 
                            type="number" 
                            className="w-full p-2 border border-gray-300 rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: 50000"
                            value={montoRecibido[pedido.id] || ''}
                            onChange={(e) => setMontoRecibido({...montoRecibido, [pedido.id]: e.target.value})}
                          />
                        </div>

                        {recibido > 0 && (
                          <div className={`text-center font-bold text-lg py-2 rounded-lg ${cambio >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cambio >= 0 
                              ? ` Devolver: $${cambio.toLocaleString('es-CO')}` 
                              : `️ Faltan: $${Math.abs(cambio).toLocaleString('es-CO')}`
                            }
                          </div>
                        )}

                        <button 
                          onClick={() => liberarMesa(pedido.id, pedido.table_id)}
                          disabled={!esSuficiente}
                          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                        >
                          ✅ Confirmar Pago y Liberar
                        </button>
                      </div>
                    )}

                    {/* BOTONES DE ESTADOS ANTERIORES */}
                    {pedido.status === 'Pendiente' && (
                      <button onClick={() => cambiarEstado(pedido.id, 'Preparando')} className="w-full bg-yellow-500 text-white py-3 rounded-lg font-bold hover:bg-yellow-600 transition">
                        🔄 Preparando
                      </button>
                    )}
                    
                    {pedido.status === 'Preparando' && (
                      <button onClick={() => cambiarEstado(pedido.id, 'Listo')} className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition">
                        ✅ Marcar como Listo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Kitchen;