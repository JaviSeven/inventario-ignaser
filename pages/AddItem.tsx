
import React, { useState, useRef } from 'react';
import { Camera, Save, X, MapPin, Package, MapPinned, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { User } from '../types';

interface AddItemProps {
  onAdd: (item: { concept: string; obra: string; description: string; imageUrl: string; quantity: number; location: string; isRecurrent: boolean; minStock?: number }) => void | Promise<void>;
  onBulkAdd: (items: Array<{ concept: string; obra: string; description: string; quantity: number; location: string }>) => Promise<{ created: number; skipped: number }>;
  currentUser: User;
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const pickValue = (row: Record<string, unknown>, aliases: string[]) => {
  const normalized = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeHeader(String(key))] = value;
    return acc;
  }, {});
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const AddItem: React.FC<AddItemProps> = ({ onAdd, onBulkAdd, currentUser }) => {
  const navigate = useNavigate();

  if (currentUser.role === 'SoloLectura') {
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in duration-500 pb-12">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-slate-400 w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Sin permisos</h2>
          <p className="text-slate-500 mb-8 text-sm">Tu usuario tiene permisos de solo lectura. No puedes dar entrada a material.</p>
          <button
            onClick={() => navigate('/inventory')}
            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Volver al inventario
          </button>
        </div>
      </div>
    );
  }
  const [concept, setConcept] = useState('');
  const [obra, setObra] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [location, setLocation] = useState('');
  const [isRecurrent, setIsRecurrent] = useState<'no' | 'si'>('no');
  const [minStock, setMinStock] = useState<string>('1');
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMinStock = Math.floor(Number(minStock));
    const recurrent = isRecurrent === 'si';
    if (!concept || !obra || !description || quantity < 1 || !location.trim()) return;
    if (recurrent && (!Number.isFinite(parsedMinStock) || parsedMinStock < 1)) return;

    await onAdd({
      concept,
      obra,
      description,
      imageUrl: imageUrl || '',
      quantity,
      location: location.trim(),
      isRecurrent: recurrent,
      minStock: recurrent ? parsedMinStock : undefined
    });

    navigate('/inventory');
  };

  const downloadTemplate = () => {
    const template = XLSX.utils.aoa_to_sheet([
      ['Concepto', 'Obra', 'Descripción', 'Unidades', 'Ubicación'],
      ['Cable UTP Cat6', 'Obra Norte', 'Caja abierta, material revisado', 12, 'Estantería A1'],
      ['Tubo PVC 20mm', 'Obra Centro', 'Tramo de 3 metros', 30, 'Pasillo 2 - Balda 4']
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, template, 'Plantilla');
    XLSX.writeFile(workbook, 'plantilla_carga_masiva_inventario.xlsx');
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkMessage(null);
    setBulkError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        setBulkError('El archivo no tiene hojas válidas.');
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const parsed: Array<{ concept: string; obra: string; description: string; quantity: number; location: string }> = [];
      let invalidRows = 0;

      for (const row of rows) {
        const concept = String(pickValue(row, ['Concepto', 'Concepto / Nombre', 'Nombre', 'Material'])).trim();
        const obra = String(pickValue(row, ['Obra', 'Obra de procedencia'])).trim();
        const description = String(pickValue(row, ['Descripción', 'Descripcion', 'Descripción / Observaciones', 'Observaciones'])).trim();
        const location = String(pickValue(row, ['Ubicación', 'Ubicacion', 'Ubicación en el almacén', 'Ubicacion en el almacen'])).trim();
        const rawQuantity = pickValue(row, ['Unidades', 'Cantidad', 'Qty', 'Quantity']);
        const quantity = Math.floor(Number(String(rawQuantity).replace(',', '.')));

        const isEmptyRow = !concept && !obra && !description && !location && !String(rawQuantity).trim();
        if (isEmptyRow) continue;

        if (!concept || !obra || !description || !location || !Number.isFinite(quantity) || quantity < 1) {
          invalidRows += 1;
          continue;
        }

        parsed.push({ concept, obra, description, quantity, location });
      }

      if (parsed.length === 0) {
        setBulkError('No se encontraron filas válidas para importar. Revisa la plantilla.');
        return;
      }

      const result = await onBulkAdd(parsed);
      const totalSkipped = result.skipped + invalidRows;
      setBulkMessage(`Carga masiva completada: ${result.created} materiales creados${totalSkipped > 0 ? `, ${totalSkipped} omitidos` : ''}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setBulkError(`No se pudo procesar el Excel: ${message}`);
    } finally {
      setBulkLoading(false);
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Dar entrada a material</h2>
          <p className="text-slate-500 mb-8 text-sm">Completa los datos del material e indica las unidades y la ubicación en el almacén.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Concepto / Nombre</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Ej. Bobina de cobre 2.5"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  <MapPin size={14} className="text-blue-600" /> Obra de procedencia
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Ej. C.C. La Maquinista"
                  value={obra}
                  onChange={(e) => setObra(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Descripción / Observaciones</label>
              <textarea
                required
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                placeholder="Indica el estado del material o cualquier detalle relevante..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  <Package size={14} className="text-blue-600" /> Unidades
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Cantidad que entra"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  <MapPinned size={14} className="text-blue-600" /> Ubicación en el almacén
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Ej. Estantería A3, Pasillo 2"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Material recurrente</label>
                <select
                  value={isRecurrent}
                  onChange={(e) => setIsRecurrent(e.target.value as 'no' | 'si')}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="no">No</option>
                  <option value="si">Si</option>
                </select>
              </div>
              {isRecurrent === 'si' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Cantidad minima en stock</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Ej. 10"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700">Fotografía del Material</label>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative h-64 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors group overflow-hidden"
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} className="w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="text-white" size={48} />
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <Camera className="text-slate-400 group-hover:text-blue-500" size={32} />
                    </div>
                    <p className="text-slate-600 font-medium">Click para subir foto del material</p>
                    <p className="text-xs text-slate-400 mt-2">Puedes capturar desde el móvil o subir archivo</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <X size={20} /> Cancelar
              </button>
              <button
                type="submit"
                className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Save size={20} /> Dar entrada
              </button>
            </div>

            <div className="border-t border-slate-200 pt-6 mt-2">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Carga masiva por Excel</h3>
              <p className="text-sm text-slate-500 mb-4">
                Descarga la plantilla, rellénala y súbela para crear varios materiales en un solo paso.
              </p>
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100"
                >
                  Descargar plantilla Excel
                </button>
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={bulkLoading}
                  className="px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition-colors border border-blue-100 disabled:opacity-60"
                >
                  {bulkLoading ? 'Importando...' : 'Subir archivo Excel'}
                </button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelImport}
                />
              </div>
              {bulkMessage && <p className="mt-3 text-sm text-emerald-700 font-medium">{bulkMessage}</p>}
              {bulkError && <p className="mt-3 text-sm text-rose-600 font-medium">{bulkError}</p>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddItem;
