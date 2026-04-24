// shared/services/storage.service.ts
import { Injectable } from '@angular/core';
import { User } from '../interfaces/user.interface';

@Injectable({ providedIn: 'root' })
export class StorageService {
  getUser(): User | null {
    const stored = localStorage.getItem('user');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  }

  setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  }

  clearUser(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('gkt_daily_verse');
  }
}