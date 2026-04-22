
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Package, 
  History, 
  PlusCircle, 
 
  FileDown, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search,
  LayoutDashboard,
  LogOut,
  Camera,
  Trash2,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

import { supabase } from './supabaseClient';
import { StockItem, Movement, User, UserRole } from './types';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import MovementsHistory from './pages/MovementsHistory';
import AddItem from './pages/AddItem';

function userFromSession(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  const role = (user.user_metadata?.role as UserRole) ?? 'SoloLectura';
  const name = (user.user_metadata?.name as string) ?? user.email ?? 'Usuario';
  return { id: user.id, name, role };
}

function mapItemRow(row: Record<string, unknown>): StockItem {
  return {
    id: row.id as string,
    concept: row.concept as string,
    description: row.description as string,
    obra: row.obra as string,
    quantity: Number(row.quantity),
    location: (row.location as string) || undefined,
    imageUrl: (row.image_url as string) ?? '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function mapMovementRow(row: Record<string, unknown>): Movement {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    itemConcept: row.item_concept as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    type: row.type as Movement['type'],
    quantityChange: Number(row.quantity_change),
    newQuantity: Number(row.new_quantity),
    timestamp: Number(row.timestamp),
    note: (row.note as string) || undefined,
    obraProcedencia: (row.obra_procedencia as string) || undefined,
    obraDestino: (row.obra_destino as string) || undefined
  };
}

function getLoginErrorMessage(error: { message?: string; code?: string } | null): string {
  if (!error) return 'No se pudo iniciar sesión.';
  if (error.message?.toLowerCase().includes('failed to fetch')) {
    return 'No hay conexión con Supabase. Revisa VITE_SUPABASE_URL, internet y que el proyecto esté activo.';
  }
  if (error.code === 'email_not_confirmed') {
    return 'El email no está confirmado. Confírmalo en Supabase o marca el usuario como confirmado.';
  }
  if (error.code === 'invalid_credentials') {
    return 'Usuario o contraseña incorrectos.';
  }
  if (error.message?.toLowerCase().includes('email not confirmed')) {
    return 'El email no está confirmado. Confírmalo en Supabase o marca el usuario como confirmado.';
  }
  return `No se pudo iniciar sesión: ${error.message ?? 'error desconocido'}`;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Sesión (Supabase persiste el refresh en el almacenamiento del navegador)
  useEffect(() => {
    const init = async () => {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);
      const recoveryType = params.get('type');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (recoveryType === 'recovery' && accessToken && refreshToken) {
        setRecoveryMode(true);
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (error) {
          setRecoveryError(`Enlace de recuperación inválido o caducado: ${error.message}`);
        }
        // Limpia el hash del enlace para que HashRouter no se quede "atrapado".
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(userFromSession(session.user));
      } else {
        setCurrentUser(null);
      }
      setAuthChecked(true);
    };
    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        return;
      }
      if (session?.user) {
        setCurrentUser(userFromSession(session.user));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Datos: solo con usuario autenticado (alineado con RLS "authenticated")
  useEffect(() => {
    if (!currentUser) {
      setItems([]);
      setMovements([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [itemsRes, movementsRes] = await Promise.all([
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('movements').select('*').order('timestamp', { ascending: false })
      ]);
      if (cancelled) return;
      if (itemsRes.error) console.error('Error cargando items:', itemsRes.error);
      if (movementsRes.error) console.error('Error cargando movimientos:', movementsRes.error);
      if (itemsRes.data) {
        setItems(itemsRes.data.map((row) => mapItemRow(row as Record<string, unknown>)));
      } else {
        setItems([]);
      }
      if (movementsRes.data) {
        setMovements(movementsRes.data.map((row) => mapMovementRow(row as Record<string, unknown>)));
      } else {
        setMovements([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value;
    if (!email || !password) return;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(getLoginErrorMessage(error));
      return;
    }
    if (data.user) {
      setCurrentUser(userFromSession(data.user));
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);
    const form = e.currentTarget;
    const password = (form.elements.namedItem('new-password') as HTMLInputElement)?.value;
    const confirm = (form.elements.namedItem('confirm-password') as HTMLInputElement)?.value;
    if (!password || password.length < 6) {
      setRecoveryError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setRecoveryError('Las contraseñas no coinciden.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setRecoveryError(`No se pudo cambiar la contraseña: ${error.message}`);
      return;
    }

    await supabase.auth.signOut();
    setCurrentUser(null);
    setRecoveryMode(false);
    setRecoverySuccess('Contraseña actualizada. Ya puedes iniciar sesión con la nueva.');
    form.reset();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const addItem = async (newItem: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'> & { quantity: number; location: string }) => {
    if (!currentUser || currentUser.role === 'SoloLectura') return;

    const id = crypto.randomUUID();
    const quantity = Math.max(0, newItem.quantity);
    const now = Date.now();
    const item: StockItem = {
      ...newItem,
      id,
      quantity,
      location: newItem.location,
      createdAt: now,
      updatedAt: now
    };

    const { error: itemError } = await supabase.from('items').insert({
      id,
      concept: item.concept,
      description: item.description,
      obra: item.obra,
      quantity: item.quantity,
      location: item.location ?? null,
      image_url: item.imageUrl ?? '',
      created_at: now,
      updated_at: now
    });
    if (itemError) {
      console.error('Error insertando item:', itemError);
      return;
    }

    const movementId = crypto.randomUUID();
    const movement: Movement = {
      id: movementId,
      itemId: id,
      itemConcept: item.concept,
      userId: currentUser.id,
      userName: currentUser.name,
      type: quantity > 0 ? 'IN' : 'CREATE',
      quantityChange: quantity,
      newQuantity: quantity,
      timestamp: now,
      note: quantity > 0
        ? `Entrada: ${quantity} uds. Ubicación: ${item.location}. Obra: ${item.obra}`
        : `Material recogido de obra: ${item.obra}`,
      obraProcedencia: item.obra,
      obraDestino: 'Almacén'
    };

    const { error: movError } = await supabase.from('movements').insert({
      id: movementId,
      item_id: id,
      item_concept: movement.itemConcept,
      user_id: currentUser.id,
      user_name: currentUser.name,
      type: movement.type,
      quantity_change: movement.quantityChange,
      new_quantity: movement.newQuantity,
      timestamp: movement.timestamp,
      note: movement.note ?? null,
      obra_procedencia: movement.obraProcedencia ?? null,
      obra_destino: movement.obraDestino ?? null
    });
    if (movError) {
      console.error('Error insertando movimiento:', movError);
      return;
    }

    setItems(prev => [item, ...prev]);
    setMovements(prev => [movement, ...prev]);
  };

  const addItemsBulk = async (
    bulkItems: Array<{ concept: string; obra: string; description: string; quantity: number; location: string }>
  ) => {
    if (!currentUser || currentUser.role === 'SoloLectura') {
      return { created: 0, skipped: bulkItems.length };
    }

    const createdItems: StockItem[] = [];
    const createdMovements: Movement[] = [];
    let skipped = 0;

    for (const raw of bulkItems) {
      const concept = raw.concept.trim();
      const obra = raw.obra.trim();
      const description = raw.description.trim();
      const location = raw.location.trim();
      const quantity = Math.max(0, Math.floor(raw.quantity));

      if (!concept || !obra || !description || !location || quantity < 1) {
        skipped += 1;
        continue;
      }

      const id = crypto.randomUUID();
      const now = Date.now();
      const item: StockItem = {
        id,
        concept,
        obra,
        description,
        imageUrl: '',
        quantity,
        location,
        createdAt: now,
        updatedAt: now
      };

      const { error: itemError } = await supabase.from('items').insert({
        id,
        concept: item.concept,
        description: item.description,
        obra: item.obra,
        quantity: item.quantity,
        location: item.location ?? null,
        image_url: '',
        created_at: now,
        updated_at: now
      });
      if (itemError) {
        console.error('Error insertando item en carga masiva:', itemError);
        skipped += 1;
        continue;
      }

      const movementId = crypto.randomUUID();
      const movement: Movement = {
        id: movementId,
        itemId: id,
        itemConcept: item.concept,
        userId: currentUser.id,
        userName: currentUser.name,
        type: quantity > 0 ? 'IN' : 'CREATE',
        quantityChange: quantity,
        newQuantity: quantity,
        timestamp: now,
        note: `Carga masiva Excel: ${quantity} uds. Ubicación: ${location}. Obra: ${obra}`,
        obraProcedencia: obra,
        obraDestino: 'Almacén'
      };

      const { error: movError } = await supabase.from('movements').insert({
        id: movementId,
        item_id: id,
        item_concept: movement.itemConcept,
        user_id: currentUser.id,
        user_name: currentUser.name,
        type: movement.type,
        quantity_change: movement.quantityChange,
        new_quantity: movement.newQuantity,
        timestamp: movement.timestamp,
        note: movement.note ?? null,
        obra_procedencia: movement.obraProcedencia ?? null,
        obra_destino: movement.obraDestino ?? null
      });
      if (movError) {
        console.error('Error insertando movimiento en carga masiva:', movError);
        await supabase.from('items').delete().eq('id', id);
        skipped += 1;
        continue;
      }

      createdItems.push(item);
      createdMovements.push(movement);
    }

    if (createdItems.length > 0) {
      setItems(prev => [...createdItems, ...prev]);
      setMovements(prev => [...createdMovements, ...prev]);
    }

    return { created: createdItems.length, skipped };
  };

  const updateItem = async (
    itemId: string,
    updates: { concept: string; obra: string; description: string; quantity: number; location: string; imageUrl: string }
  ) => {
    if (!currentUser || currentUser.role === 'SoloLectura') return;

    const current = items.find(i => i.id === itemId);
    if (!current) return;

    const concept = updates.concept.trim();
    const obra = updates.obra.trim();
    const description = updates.description.trim();
    const location = updates.location.trim();
    const quantity = Math.max(0, Math.floor(updates.quantity));
    if (!concept || !obra || !description || !location) return;

    const now = Date.now();
    const updatedItem: StockItem = {
      ...current,
      concept,
      obra,
      description,
      quantity,
      location,
      imageUrl: updates.imageUrl ?? '',
      updatedAt: now
    };

    const { error: updateError } = await supabase.from('items').update({
      concept: updatedItem.concept,
      obra: updatedItem.obra,
      description: updatedItem.description,
      quantity: updatedItem.quantity,
      location: updatedItem.location ?? null,
      image_url: updatedItem.imageUrl ?? '',
      updated_at: now
    }).eq('id', itemId);
    if (updateError) {
      console.error('Error actualizando item:', updateError);
      return;
    }

    const changed: string[] = [];
    if (current.concept !== updatedItem.concept) changed.push('concepto');
    if (current.obra !== updatedItem.obra) changed.push('obra');
    if (current.description !== updatedItem.description) changed.push('descripcion');
    if ((current.location ?? '') !== (updatedItem.location ?? '')) changed.push('ubicacion');
    if ((current.imageUrl ?? '') !== (updatedItem.imageUrl ?? '')) changed.push('imagen');
    if (current.quantity !== updatedItem.quantity) changed.push('cantidad');

    const quantityDiff = updatedItem.quantity - current.quantity;
    const movementId = crypto.randomUUID();
    const movement: Movement = {
      id: movementId,
      itemId: itemId,
      itemConcept: updatedItem.concept,
      userId: currentUser.id,
      userName: currentUser.name,
      type: 'ADJUST',
      quantityChange: quantityDiff,
      newQuantity: updatedItem.quantity,
      timestamp: now,
      note: changed.length > 0
        ? `Edicion de material (${changed.join(', ')})`
        : 'Edicion de material',
      obraProcedencia: updatedItem.obra,
      obraDestino: undefined
    };

    const { error: movError } = await supabase.from('movements').insert({
      id: movementId,
      item_id: itemId,
      item_concept: movement.itemConcept,
      user_id: currentUser.id,
      user_name: currentUser.name,
      type: movement.type,
      quantity_change: movement.quantityChange,
      new_quantity: movement.newQuantity,
      timestamp: movement.timestamp,
      note: movement.note ?? null,
      obra_procedencia: movement.obraProcedencia ?? null,
      obra_destino: null
    });
    if (movError) {
      console.error('Error registrando edicion en historial:', movError);
    } else {
      setMovements(prev => [movement, ...prev]);
    }

    setItems(prev => prev.map(i => (i.id === itemId ? updatedItem : i)));
  };

  const handleMaterialOut = async (itemId: string, amount: number, obraDestino: string) => {
    if (!currentUser || currentUser.role === 'SoloLectura') return;

    const item = items.find(i => i.id === itemId);
    if (!item || amount <= 0 || amount > item.quantity) return;

    const newQuantity = item.quantity - amount;
    const now = Date.now();
    const note = `Salida a obra: ${obraDestino}`;

    const outMovementId = crypto.randomUUID();
    const { error: outError } = await supabase.from('movements').insert({
      id: outMovementId,
      item_id: itemId,
      item_concept: item.concept,
      user_id: currentUser.id,
      user_name: currentUser.name,
      type: 'OUT',
      quantity_change: -amount,
      new_quantity: newQuantity,
      timestamp: now,
      note,
      obra_procedencia: 'Almacén',
      obra_destino: obraDestino
    });
    if (outError) {
      console.error('Error insertando movimiento salida:', outError);
      return;
    }

    if (newQuantity === 0) {
      const removeMovementId = crypto.randomUUID();
      const { error: removeMovError } = await supabase.from('movements').insert({
        id: removeMovementId,
        item_id: itemId,
        item_concept: item.concept,
        user_id: currentUser.id,
        user_name: currentUser.name,
        type: 'REMOVE',
        quantity_change: 0,
        new_quantity: 0,
        timestamp: Date.now(),
        note: 'Material eliminado del inventario (stock en 0)',
        obra_procedencia: 'Almacén',
        obra_destino: '—'
      });
      if (removeMovError) {
        console.error('Error insertando movimiento baja:', removeMovError);
        return;
      }
      const { error: deleteError } = await supabase.from('items').delete().eq('id', itemId);
      if (deleteError) {
        console.error('Error eliminando item:', deleteError);
        return;
      }
      setMovements(prev => [
        { id: removeMovementId, itemId, itemConcept: item.concept, userId: currentUser.id, userName: currentUser.name, type: 'REMOVE', quantityChange: 0, newQuantity: 0, timestamp: Date.now(), note: 'Material eliminado del inventario (stock en 0)', obraProcedencia: 'Almacén', obraDestino: '—' },
        { id: outMovementId, itemId, itemConcept: item.concept, userId: currentUser.id, userName: currentUser.name, type: 'OUT', quantityChange: -amount, newQuantity: 0, timestamp: now, note, obraProcedencia: 'Almacén', obraDestino: obraDestino },
        ...prev
      ]);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      const { error: updateError } = await supabase.from('items').update({ quantity: newQuantity, updated_at: now }).eq('id', itemId);
      if (updateError) {
        console.error('Error actualizando cantidad:', updateError);
        return;
      }
      setMovements(prev => [
        { id: outMovementId, itemId, itemConcept: item.concept, userId: currentUser.id, userName: currentUser.name, type: 'OUT', quantityChange: -amount, newQuantity, timestamp: now, note, obraProcedencia: 'Almacén', obraDestino: obraDestino },
        ...prev
      ]);
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, quantity: newQuantity, updatedAt: now } : i
      ));
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!currentUser || currentUser.role !== 'Admin') return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const removeMovementId = crypto.randomUUID();
    const now = Date.now();
    const { error: movError } = await supabase.from('movements').insert({
      id: removeMovementId,
      item_id: itemId,
      item_concept: item.concept,
      user_id: currentUser.id,
      user_name: currentUser.name,
      type: 'REMOVE',
      quantity_change: 0,
      new_quantity: item.quantity,
      timestamp: now,
      note: 'Eliminado por administrador',
      obra_procedencia: item.obra,
      obra_destino: null
    });
    if (movError) {
      console.error('Error registrando baja:', movError);
      return;
    }
    const { error: deleteError } = await supabase.from('items').delete().eq('id', itemId);
    if (deleteError) {
      console.error('Error eliminando item:', deleteError);
      return;
    }
    setMovements(prev => [
      { id: removeMovementId, itemId, itemConcept: item.concept, userId: currentUser.id, userName: currentUser.name, type: 'REMOVE', quantityChange: 0, newQuantity: item.quantity, timestamp: now, note: 'Eliminado por administrador', obraProcedencia: item.obra, obraDestino: undefined },
      ...prev
    ]);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const movementTypeLabel = (type: string) => {
    switch (type) {
      case 'IN': return 'Entrada';
      case 'OUT': return 'Salida';
      case 'CREATE': return 'Creación';
      case 'REMOVE': return 'Baja';
      default: return 'Ajuste';
    }
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stock Actual', { views: [{ state: 'frozen', ySplit: 1 }] });

    sheet.columns = [
      { header: 'Foto', key: 'foto', width: 14 },
      { header: 'Concepto', key: 'concept', width: 22 },
      { header: 'Obra', key: 'obra', width: 18 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Ubicación', key: 'location', width: 18 },
      { header: 'Última Actualización', key: 'updatedAt', width: 20 }
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).height = 20;

    const imgSize = { width: 80, height: 80 };
    const rowHeight = 62;

    items.forEach((item, index) => {
      const rowIndex = index + 2;
      sheet.addRow({
        foto: '',
        concept: item.concept,
        obra: item.obra,
        description: item.description,
        quantity: item.quantity,
        location: item.location || '',
        updatedAt: new Date(item.updatedAt).toLocaleString()
      });
      sheet.getRow(rowIndex).height = rowHeight;

      const img = item.imageUrl;
      if (img && typeof img === 'string' && img.startsWith('data:image')) {
        const match = img.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          const ext = match[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
          const base64 = match[2];
          try {
            const imageId = workbook.addImage({ base64, extension: ext });
            sheet.addImage(imageId, {
              tl: { col: 0, row: rowIndex - 1 },
              ext: imgSize,
              editAs: 'oneCell'
            });
          } catch (_) {}
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock_almacen.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMovementsToExcel = () => {
    const data = movements.map(m => ({
      'Fecha / Hora': new Date(m.timestamp).toLocaleString(),
      Producto: m.itemConcept,
      'ID Producto': m.itemId,
      'Obra procedencia': m.obraProcedencia ?? '',
      'Obra destino': m.obraDestino ?? '',
      Usuario: m.userName,
      Tipo: movementTypeLabel(m.type),
      Cambio: m.quantityChange,
      'Stock final': m.newQuantity,
      Nota: m.note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial Movimientos");
    XLSX.writeFile(wb, "historial_movimientos.xlsx");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <Package className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-center text-slate-800">Inventario Ignaser</h1>
          <p className="text-slate-500 mb-6 text-center text-sm">
            {recoveryMode ? 'Crea tu nueva contraseña' : 'Inicia sesión para continuar'}
          </p>

          {recoveryMode ? (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1">Nueva contraseña</label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-1">Repite la contraseña</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Repite la contraseña"
                />
              </div>
              {recoveryError && (
                <p className="text-sm text-rose-600 font-medium">{recoveryError}</p>
              )}
              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Guardar nueva contraseña
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              {(loginError || recoverySuccess) && (
                <p className={`text-sm font-medium ${loginError ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {loginError ?? recoverySuccess}
                </p>
              )}
              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Iniciar sesión
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="w-64 bg-slate-900 text-white flex-col hidden md:flex sticky top-0 h-screen">
          <div className="p-6 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Inventario Ignaser</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 mt-4">
            <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <SidebarLink to="/inventory" icon={<Package size={20} />} label="Inventario" />
            <SidebarLink to="/history" icon={<History size={20} />} label="Historial" />
            {currentUser.role !== 'SoloLectura' && (
              <SidebarLink to="/add" icon={<ArrowUpCircle size={20} />} label="Entrada de Material" />
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 mb-4">
              
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400">{currentUser.role === 'SoloLectura' ? 'Solo lectura' : currentUser.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 w-full p-2 text-slate-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors text-sm"
            >
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        </aside>

        <main className="flex-1 pb-20 md:pb-0">
          <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
            <h1 className="font-bold text-slate-800 md:text-xl">
              <RouteTitle />
            </h1>
            
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={exportToExcel}
                className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors border border-emerald-100"
              >
                <FileDown size={16} /> Excel Inventario
              </button>
              <button 
                onClick={exportMovementsToExcel}
                className="hidden md:flex items-center gap-2 bg-violet-50 text-violet-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-100 transition-colors border border-violet-100"
              >
                <FileDown size={16} /> Excel Historial
              </button>
              <div className="md:hidden flex items-center gap-2">
                <button onClick={() => exportToExcel()} className="p-2 text-emerald-600" title="Excel Inventario"><FileDown size={20} /></button>
                <button onClick={exportMovementsToExcel} className="p-2 text-violet-600" title="Excel Historial"><History size={20} /></button>
                <button onClick={handleLogout} className="p-2 text-slate-400"><LogOut size={20} /></button>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={
                <Dashboard items={items} movements={movements} />
              } />
              <Route path="/inventory" element={
                <Inventory 
                  items={items} 
                  onMaterialOut={handleMaterialOut}
                  onUpdate={updateItem}
                  onDelete={deleteItem}
                  currentUser={currentUser}
                />
              } />
              <Route path="/history" element={
                <MovementsHistory movements={movements} />
              } />
              <Route path="/add" element={
                <AddItem onAdd={addItem} onBulkAdd={addItemsBulk} currentUser={currentUser} />
              } />
            </Routes>
          </div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around px-2 z-50">
          <MobileLink to="/" icon={<LayoutDashboard size={24} />} />
          <MobileLink to="/inventory" icon={<Package size={24} />} />
          {currentUser.role !== 'SoloLectura' && (
            <MobileLink to="/add" icon={<ArrowUpCircle size={32} className="text-blue-600" />} />
          )}
          <MobileLink to="/history" icon={<History size={24} />} />
        </nav>
      </div>
    </HashRouter>
  );
};

const RouteTitle = () => {
  const location = useLocation();
  switch(location.pathname) {
    case '/': return 'Resumen del Almacén';
    case '/inventory': return 'Gestión de Inventario';
    case '/history': return 'Historial de Movimientos';
    case '/add': return 'Entrada de Material';
    default: return 'Inventario Ignaser';
  }
};

const SidebarLink = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
  <Link 
    to={to} 
    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white group"
  >
    <span className="group-hover:scale-110 transition-transform">{icon}</span>
    <span className="font-medium">{label}</span>
  </Link>
);

const MobileLink = ({ to, icon }: { to: string, icon: React.ReactNode }) => (
  <Link to={to} className="p-3 text-slate-400 hover:text-blue-600 transition-colors">
    {icon}
  </Link>
);

export default App;
