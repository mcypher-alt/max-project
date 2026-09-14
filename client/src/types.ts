export interface Company {
  id: string;
  name: string;
}

export interface House {
  id: number;
  address: string;
  companyId: string;
}

export interface User {
  id: number;
  phone: string;
  name: string;
  role: 'admin' | 'dispatcher' | 'master';
  companyId: string; // В диспетчерской может быть массив, если логика бэка отдаст companyIds: string[]
}

export interface Ticket {
  id: number;
  address: string;
  description: string;
  type: 'emergency' | 'regular';
  status: 'new' | 'in_work' | 'completed';
  createdAt: string;
  assignedAt?: string | null;
  completedAt?: string | null;
  companyId: string;
  masterId?: number | null;
  managerRating?: number | null;
  managerComment?: string | null;
}