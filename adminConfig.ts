// adminConfig.ts
// ---------------------------------------------------------------------------
// CREDENTIAL CONFIGURATION
// To change a password: edit the `password` field directly.
// To add outlet-specific credentials: duplicate a manager/staff block,
//   set outletId to the outlet's id string from OUTLET_LOCATIONS, and
//   assign a unique username.
// The default credentials (outletId: null) will trigger an outlet-selector
//   screen after login when multiple outlets exist.
// ---------------------------------------------------------------------------

import { AdminRole } from './types';

export interface AdminUser {
  role: AdminRole;
  username: string;
  password: string;
  outletId: string | null;
  // null on manager/staff = "universal" -> outlet-selector shown after login
  // null on admin = intentional (admin always sees all)
}

export const ADMIN_USERS: AdminUser[] = [
  {
    role: 'admin',
    username: 'Admin_Harinos',
    password: 'Harinos_Admin',
    outletId: null,
  },
  {
    role: 'manager',
    username: 'Manager_Harinos',
    password: 'Harinos_Manager',
    outletId: null,
  },
  {
    role: 'staff',
    username: 'Staff_Harinos',
    password: 'Harinos_Staff',
    outletId: null,
  },

  // Outlet-specific credentials can be added when more outlets open.
  // { role: 'manager', username: 'Manager_Harinos_2', password: 'change_me', outletId: 'outlet-2' },
  // { role: 'staff', username: 'Staff_Harinos_2', password: 'change_me', outletId: 'outlet-2' },
];

export function authenticateAdmin(username: string, password: string): AdminUser | null {
  return ADMIN_USERS.find((user) => user.username === username && user.password === password) ?? null;
}
