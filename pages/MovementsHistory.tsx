import React, { useState } from 'react';
import { Movement } from '../types';
import { ArrowUpCircle, ArrowDownCircle, PlusCircle, Trash2, Clock, Search } from 'lucide-react';

const typeLabels: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  CREATE: 'Creación',
  REMOVE: 'Baja',
  ADJUST: 'Ajuste'
};

interface HistoryProps {
  movements: Movement[];
}

const MovementsHistory: React.FC<HistoryProps> = ({ movements }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMovements = movements.filter(m => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const obraProc = (m.obraProcedencia || '').toLowerCase();
    const obraDest = (m.obraDestino || '').toLowerCase();
    const tipo = (typeLabels[m.type] || '').toLowerCase();
    return (
      m.itemConcept.toLowerCase().includes(term) ||
      m.userName.toLowerCase().includes(term) ||
      m.itemId.toLowerCase().includes(term) ||
      (m.note || '').toLowerCase().includes(term) ||
      obraProc.includes(term) ||
      obraDest.includes(term) ||
      tipo.includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por producto, usuario, obra, tipo, nota..."
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha / Hora</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Obra procedencia</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Obra destino</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cambio</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock size={14} className="text-slate-400" />
                      {new Date(m.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{m.itemConcept}</div>
                    <div className="text-[10px] text-slate-400">ID: {m.itemId.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{m.obraProcedencia ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{m.obraDestino ?? '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                        <img src={`https://picsum.photos/seed/${m.userId}/30`} alt="" />
                      </div>
                      <span className="text-sm font-medium">{m.userName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <MovementTag type={m.type} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${
                      m.quantityChange > 0 ? 'text-emerald-600' :
                      m.quantityChange < 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange === 0 ? '-' : m.quantityChange}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-slate-800">{m.newQuantity}</span>
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-slate-400 italic">
                    {movements.length === 0
                      ? 'No hay registros en el historial todavía.'
                      : 'No hay movimientos que coincidan con la búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MovementTag = ({ type }: { type: string }) => {
  switch (type) {
    case 'IN':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
          <ArrowUpCircle size={12} /> Entrada
        </span>
      );
    case 'OUT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold uppercase">
          <ArrowDownCircle size={12} /> Salida
        </span>
      );
    case 'CREATE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
          <PlusCircle size={12} /> Creación
        </span>
      );
    case 'REMOVE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase">
          <Trash2 size={12} /> Baja
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 text-slate-600 text-[10px] font-bold uppercase">
          Ajuste
        </span>
      );
  }
};

export default MovementsHistory;
