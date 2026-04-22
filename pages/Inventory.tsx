
import React, { useState } from 'react';
import { StockItem, User } from '../types';
import { Search, Trash2, MapPin, MapPinned, ArrowDownCircle, X, Check, Pencil, ImagePlus, ClipboardList, FilterX } from 'lucide-react';

interface InventoryProps {
  items: StockItem[];
  onMaterialOut: (itemId: string, amount: number, obraDestino: string) => void;
  onUpdate: (itemId: string, updates: { concept: string; obra: string; description: string; quantity: number; location: string; imageUrl: string; isRecurrent: boolean; minStock?: number }) => void | Promise<void>;
  onDelete: (id: string) => void;
  currentUser: User;
}

const Inventory: React.FC<InventoryProps> = ({ items, onMaterialOut, onUpdate, onDelete, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyMinimum, setOnlyMinimum] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [salidaModal, setSalidaModal] = useState<{ item: StockItem } | null>(null);
  const [salidaObra, setSalidaObra] = useState('');
  const [salidaUnidades, setSalidaUnidades] = useState('1');
  const [editModal, setEditModal] = useState<{ item: StockItem } | null>(null);
  const [editConcept, setEditConcept] = useState('');
  const [editObra, setEditObra] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editLocation, setEditLocation] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editIsRecurrent, setEditIsRecurrent] = useState<'no' | 'si'>('no');
  const [editMinStock, setEditMinStock] = useState('1');

  const openSalidaModal = (item: StockItem) => {
    setSalidaModal({ item });
    setSalidaObra('');
    setSalidaUnidades('1');
  };

  const closeSalidaModal = () => {
    setSalidaModal(null);
    setSalidaObra('');
    setSalidaUnidades('1');
  };

  const openEditModal = (item: StockItem) => {
    setEditModal({ item });
    setEditConcept(item.concept);
    setEditObra(item.obra);
    setEditDescription(item.description);
    setEditQuantity(String(item.quantity));
    setEditLocation(item.location ?? '');
    setEditImageUrl(item.imageUrl ?? '');
    setEditIsRecurrent(item.isRecurrent ? 'si' : 'no');
    setEditMinStock(String(item.minStock ?? 1));
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditConcept('');
    setEditObra('');
    setEditDescription('');
    setEditQuantity('1');
    setEditLocation('');
    setEditImageUrl('');
    setEditIsRecurrent('no');
    setEditMinStock('1');
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const confirmEdit = async () => {
    if (!editModal) return;
    const quantity = Math.floor(Number(editQuantity));
    const recurrent = editIsRecurrent === 'si';
    const minStock = Math.floor(Number(editMinStock));
    if (!editConcept.trim() || !editObra.trim() || !editDescription.trim() || !editLocation.trim()) return;
    if (!Number.isFinite(quantity) || quantity < 0) return;
    if (recurrent && (!Number.isFinite(minStock) || minStock < 1)) return;

    await onUpdate(editModal.item.id, {
      concept: editConcept.trim(),
      obra: editObra.trim(),
      description: editDescription.trim(),
      quantity,
      location: editLocation.trim(),
      imageUrl: editImageUrl || '',
      isRecurrent: recurrent,
      minStock: recurrent ? minStock : undefined
    });
    closeEditModal();
  };

  const confirmSalida = () => {
    if (!salidaModal || !salidaObra.trim()) return;
    const requested = Math.floor(Number(salidaUnidades));
    if (!Number.isFinite(requested) || requested < 1) return;
    const max = Math.min(requested, salidaModal.item.quantity);
    if (max < 1) return;
    onMaterialOut(salidaModal.item.id, max, salidaObra.trim());
    closeSalidaModal();
  };

  const filteredItems = items.filter(item => 
    item.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.obra.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recurrentLowStock = filteredItems.filter(
    (item) => item.isRecurrent && typeof item.minStock === 'number' && item.quantity <= item.minStock
  );

  const displayedItems = onlyMinimum ? recurrentLowStock : filteredItems;

  const copyQuickOrder = async () => {
    if (recurrentLowStock.length === 0) {
      setOrderMessage('No hay materiales en minimo para pedir.');
      return;
    }
    const lines = recurrentLowStock.map((item) => {
      const min = item.minStock ?? 0;
      const suggested = Math.max(min * 2 - item.quantity, 1);
      return `- ${item.concept} | Stock actual: ${item.quantity} | Minimo: ${min} | Pedido sugerido: ${suggested} uds.`;
    });
    const text = `Pedido rapido de reposicion\n\n${lines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setOrderMessage('Lista de pedido copiada al portapapeles.');
    } catch {
      setOrderMessage('No se pudo copiar automaticamente. Revisa permisos del navegador.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por concepto, obra o descripción..."
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOnlyMinimum((prev) => !prev)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
            onlyMinimum
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {onlyMinimum ? <FilterX size={16} className="inline mr-2" /> : <ClipboardList size={16} className="inline mr-2" />}
          {onlyMinimum ? 'Ver todo el inventario' : 'Ver solo materiales en minimo'}
        </button>
        <button
          type="button"
          onClick={copyQuickOrder}
          disabled={recurrentLowStock.length === 0}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          <ClipboardList size={16} className="inline mr-2" />
          Copiar pedido rapido
        </button>
        {orderMessage && <span className="text-sm text-slate-600">{orderMessage}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recurrentLowStock.length > 0 && (
          <div className="col-span-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            Aviso de reposicion: {recurrentLowStock.length} material(es) recurrente(s) en minimo.
          </div>
        )}
        {displayedItems.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
            <div className="relative h-48 bg-slate-100 overflow-hidden">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                  alt={item.concept} 
                />
              ) : null}
              <div className="absolute top-2 right-2">
                {currentUser.role === 'Admin' && (
                  <button 
                    onClick={() => {
                      if(confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
                        onDelete(item.id);
                      }
                    }}
                    className="p-2 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {currentUser.role !== 'SoloLectura' && (
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1">
                <MapPin size={10} className="text-blue-600" /> {item.obra}
              </div>
            </div>

            <div className="p-5">
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-slate-800 text-lg truncate flex-1">{item.concept}</h4>
                <span className="text-[10px] text-slate-400 font-mono mt-1">ID: {item.id.slice(0, 5)}</span>
              </div>
              <p className="text-slate-500 text-sm mt-1 line-clamp-2 min-h-[40px]">{item.description}</p>
              {item.location && (
                <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
                  <MapPinned size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </p>
              )}
              {item.isRecurrent && (
                <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  typeof item.minStock === 'number' && item.quantity <= item.minStock
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  Recurrente{typeof item.minStock === 'number' ? ` · Min: ${item.minStock}` : ''}
                </div>
              )}
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Stock Almacenado</span>
                  <span className="text-2xl font-black text-slate-800">
                    {item.quantity} <span className="text-xs font-medium text-slate-400">uds.</span>
                  </span>
                </div>
                {currentUser.role !== 'SoloLectura' && (
                  <button
                    onClick={() => openSalidaModal(item)}
                    disabled={item.quantity === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl font-semibold text-sm hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowDownCircle size={18} /> Salida de material
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {displayedItems.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-400" size={32} />
            </div>
            <p className="text-slate-500 font-medium">
              {onlyMinimum ? 'No hay materiales recurrentes en minimo.' : 'No se encontraron artículos con esos criterios.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal Salida de material */}
      {salidaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeSalidaModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-1">Salida de material</h3>
            <p className="text-sm text-slate-500 mb-6">{salidaModal.item.concept}</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Obra de destino</label>
                <input
                  type="text"
                  value={salidaObra}
                  onChange={e => setSalidaObra(e.target.value)}
                  placeholder="Ej. C.C. La Maquinista"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Unidades que salen</label>
                <input
                  type="number"
                  min={1}
                  max={salidaModal.item.quantity}
                  value={salidaUnidades}
                  onChange={e => setSalidaUnidades(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-xs text-slate-400 mt-1">Máximo: {salidaModal.item.quantity} uds.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeSalidaModal}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200"
              >
                <X size={18} /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSalida}
                disabled={!salidaObra.trim() || !Number.isFinite(Number(salidaUnidades)) || Number(salidaUnidades) < 1}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                <Check size={18} /> Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edición material */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeEditModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-1">Editar material</h3>
            <p className="text-sm text-slate-500 mb-6">Actualiza cualquier dato del material.</p>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Concepto</label>
                  <input
                    type="text"
                    value={editConcept}
                    onChange={e => setEditConcept(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Obra de procedencia</label>
                  <input
                    type="text"
                    value={editObra}
                    onChange={e => setEditObra(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripcion</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Unidades en stock</label>
                  <input
                    type="number"
                    min={0}
                    value={editQuantity}
                    onChange={e => setEditQuantity(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ubicacion en almacen</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Material recurrente</label>
                  <select
                    value={editIsRecurrent}
                    onChange={(e) => setEditIsRecurrent(e.target.value as 'no' | 'si')}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="no">No</option>
                    <option value="si">Si</option>
                  </select>
                </div>
                {editIsRecurrent === 'si' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Cantidad minima en stock</label>
                    <input
                      type="number"
                      min={1}
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Foto del material</label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
                    <ImagePlus size={16} /> Cambiar imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditImageChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditImageUrl('')}
                    className="px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    Quitar imagen
                  </button>
                </div>
                {editImageUrl ? (
                  <img src={editImageUrl} alt="Preview" className="mt-3 h-32 w-32 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <p className="text-xs text-slate-400 mt-2">Sin imagen.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200"
              >
                <X size={18} /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmEdit}
                disabled={
                  !editConcept.trim() ||
                  !editObra.trim() ||
                  !editDescription.trim() ||
                  !editLocation.trim() ||
                  !Number.isFinite(Number(editQuantity)) ||
                  Number(editQuantity) < 0 ||
                  (editIsRecurrent === 'si' && (!Number.isFinite(Number(editMinStock)) || Number(editMinStock) < 1))
                }
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={18} /> Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
