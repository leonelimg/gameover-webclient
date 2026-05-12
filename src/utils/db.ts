import { Draw, Plan, Ticket, User } from '@/types';

// ─── Seed Data ────────────────────────────────────────────────────────────────

const ADMIN_USER: User = {
  id: 'u-admin',
  fullName: 'Administrador Principal',
  username: 'admin',
  email: 'admin@gameover.com',
  phone: '0000-0000',
  role: 'admin',
  status: 'activo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SEED_USERS: User[] = [
  ADMIN_USER,
  {
    id: 'u-aso1',
    fullName: 'Juan Pérez',
    username: 'jperez',
    email: 'juan@gameover.com',
    phone: '8888-1111',
    role: 'asociado',
    status: 'activo',
    planId: 'plan-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'u-aso2',
    fullName: 'María López',
    username: 'mlopez',
    email: 'maria@gameover.com',
    phone: '8888-2222',
    role: 'asociado',
    status: 'activo',
    planId: 'plan-2',
    parentId: 'u-aso1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'u-vend1',
    fullName: 'Carlos Ruiz',
    username: 'cruiz',
    email: 'carlos@gameover.com',
    phone: '8888-3333',
    role: 'vendedor',
    status: 'activo',
    planId: 'plan-1',
    parentId: 'u-aso1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEED_PLANS: Plan[] = [
  {
    id: 'plan-1',
    name: 'Plan Básico',
    multiplier: 60,
    commission: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'plan-2',
    name: 'Plan Premium',
    multiplier: 80,
    commission: 15,
    masterId: 'u-aso1',
    createdAt: new Date().toISOString(),
  },
];

const now = new Date();
const todayClose = new Date(now);
todayClose.setHours(21, 0, 0, 0);

const SEED_DRAWS: Draw[] = [
  {
    id: 'draw-1',
    name: 'Sorteo Matutino',
    closeTime: todayClose.toISOString(),
    minutosPreviosCierre: 10,
    status: 'abierto',
    restrictedNumbers: [
      { number: '00', limit: 500 },
      { number: '11', limit: 300 },
    ],
    createdAt: new Date().toISOString(),
  },
];

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function load<T>(key: string, seed: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  } catch {
    return seed;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const db = {
  // Users
  getUsers: (): User[] => load('go_users', SEED_USERS),
  saveUsers: (users: User[]) => save('go_users', users),

  // Plans
  getPlans: (): Plan[] => load('go_plans', SEED_PLANS),
  savePlans: (plans: Plan[]) => save('go_plans', plans),

  // Draws
  getDraws: (): Draw[] => load('go_draws', SEED_DRAWS),
  saveDraws: (draws: Draw[]) => save('go_draws', draws),

  // Tickets
  getTickets: (): Ticket[] => load('go_tickets', []),
  saveTickets: (tickets: Ticket[]) => save('go_tickets', tickets),

  // Auth helpers
  findUserByCredentials: (username: string, password: string): User | null => {
    // Simple password check: for demo, all users have password "password123"
    // Admin also accepts "admin123"
    const users = load('go_users', SEED_USERS);
    const user = users.find(
      (u) => u.username === username && u.status === 'activo'
    );
    if (!user) return null;
    const validPasswords: Record<string, string[]> = {
      admin: ['admin123', 'password123'],
    };
    const allowed = validPasswords[username] ?? ['password123'];
    return allowed.includes(password) ? user : null;
  },
};
