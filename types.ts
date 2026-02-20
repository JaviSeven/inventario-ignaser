
export type UserRole = 'Admin' | 'Operario' | 'SoloLectura';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;   // <- antes era: avatar: string;
}


export interface StockItem {
  id: string;
  concept: string;
  description: string;
  obra: string; // Obra de procedencia
  quantity: number;
  location?: string; // Ubicación dentro del almacén
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
}

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

