
import React from 'react';
import { StockItem, Movement } from '../types';
import { Clock, Package, ListFilter, Activity, Plus } from 'lucide-react';

interface DashboardProps {
  items: StockItem[];
  movements: Movement[];
}

const Dashboard: React.FC<DashboardProps> = ({ items, movements }) => {
  const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);
  const recentMovements = movements.slice(0, 8);
  const latestAdded = [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const stats = [
    { label: 'Variedades de Material', value: items.length, icon: <Package className="text-blue-600" />, bg: 'bg-blue-50' },
    { label: 'Unidades Totales', value: totalStock, icon: <ListFilter className="text-emerald-600" />, bg: 'bg-emerald-50' },
    { label: 'Movimientos Realizados', value: movements.length, icon: <Activity className="text-indigo-600" />, bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</h3>
            </div>
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Latest Items Added */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Plus size={20} className="text-blue-500" /> Últimos Artículos Añadidos
          </h3>
          <div className="space-y-4">
            {latestAdded.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} className="w-12 h-12 rounded-lg object-cover shadow-sm" alt="" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-sm text-slate-800">{item.concept}</p>
                    <p className="text-xs text-slate-500">Obra: <span className="text-blue-600 font-medium">{item.obra}</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  <div className="text-slate-800 font-black text-sm">{item.quantity} uds.</div>
                </div>
              </div>
            ))}
            {latestAdded.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-slate-400 italic">No hay artículos registrados aún</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Movements */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock size={20} className="text-indigo-500" /> Actividad Reciente
          </h3>
          <div className="space-y-6">
            {recentMovements.map(m => (
              <div key={m.id} className="flex gap-4 items-start border-l-2 border-slate-100 pl-4 relative">
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                  m.type === 'IN' ? 'bg-emerald-500' : 
                  m.type === 'OUT' ? 'bg-rose-500' : 
                  m.type === 'REMOVE' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-slate-800">
                      {m.type === 'CREATE' ? 'Registro:' : m.type === 'IN' ? 'Entrada:' : m.type === 'REMOVE' ? 'Baja:' : 'Salida:'} {m.itemConcept}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {m.userName} — {m.type === 'CREATE' ? 'Nuevo ingreso al almacén' : m.type === 'REMOVE' ? 'Eliminado del inventario (stock 0)' : `${Math.abs(m.quantityChange)} unidades`}
                  </p>
                </div>
              </div>
            ))}
            {recentMovements.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-slate-400 italic">No hay movimientos registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
