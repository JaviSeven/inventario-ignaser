
export type UserRole = 'Admin' | 'Operario' | 'SoloLectura';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatar?: string;   // <- antes era: avatar: string;
}


export interface StockItem {
  id: string;
  concept: string;
  description: string;
  obra: string; // Obra de procedencia
  quantity: number;
  isRecurrent: boolean;
  minStock?: number;
  location?: string; // Ubicación dentro del almacén
  category?: string; // Categoría del material
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
}

// Lista fija de categorías (la misma que en la app de AXIS)
export const CATEGORIAS = [
  'CONSTRUCCION',
  'ELECTRODOMESTICOS',
  'ILUMINARIA',
  'JARDINERIA',
  'MOBILIARIO',
  'MOLDURAS',
  'PERFILERIA',
  'SANITARIOS',
  'SUELOS',
  'TECHOS'
] as const;

export type Categoria = typeof CATEGORIAS[number];

// Devuelve la categoría oficial que coincide con el texto (sin distinguir mayúsculas ni acentos), o null
export const matchCategoria = (raw: string): Categoria | null => {
  const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  const target = norm(raw);
  if (!target) return null;
  return CATEGORIAS.find(c => norm(c) === target) ?? null;
};

// Categorías ya usadas en el inventario (sin duplicados, ordenadas), para sugerirlas al escribir
export const getExistingCategories = (items: StockItem[]): string[] => {
  const byKey = new Map<string, string>();
  for (const item of items) {
    const category = item.category?.trim();
    if (category && !byKey.has(category.toLowerCase())) byKey.set(category.toLowerCase(), category);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
};

// Usuarios que siempre pueden editar las unidades del inventario,
// independientemente del rol guardado en Supabase.
export const UNIT_EDITOR_EMAILS = ['jrserna@ignaser.es'];

export const canEditUnits = (user: User | null | undefined): boolean => {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'Operario') return true;
  return !!user.email && UNIT_EDITOR_EMAILS.includes(user.email.toLowerCase());
};

export type MovementType = 'IN' | 'OUT' | 'ADJUST' | 'CREATE' | 'REMOVE';

export interface Movement {
  id: string;
  itemId: string;
  itemConcept: string;
  userId: string;
  userName: string;
  type: MovementType;
  quantityChange: number;
  newQuantity: number;
  timestamp: number;
  note?: string;
  obraProcedencia?: string; // Obra de procedencia
  obraDestino?: string;     // Obra de destino
}

export const USERS: User[] = [
  { id: 'u1', name: 'IGNASER', role: 'Admin' },
  { id: 'u2', name: 'AXIS', role: 'SoloLectura' }
];

