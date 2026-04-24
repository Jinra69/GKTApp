// shared/interfaces/user.interface.ts
export interface User {
  mob_id: number;
  user_name: string;
  cc_id: number | null;
}

export interface Church {
  cc_id: number;
  cc_name: string;
}

export interface MenuItem {
  icon: string;
  name: string;
  desc: string;
  bg: string;
  detail: string;
  action?: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}