// shared/services/storage.service.ts
import { Injectable } from '@angular/core';
import { User } from '../interfaces/user.interface';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly USER_KEY = 'user';
  private readonly TOKEN_KEY = 'gkt_token';
  private readonly REMEMBER_KEY = 'gkt_remember';
  private readonly SESSION_KEY = 'gkt_session';

  getUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  }

  setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.SESSION_KEY, Date.now().toString());
  }

  clearUser(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem('gkt_daily_verse');
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  isSessionValid(): boolean {
    const user = this.getUser();
    const token = this.getToken();
    const sessionTime = localStorage.getItem(this.SESSION_KEY);
    
    if (!user || !token || !sessionTime) return false;
    
    // Session expired after 7 days
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const sessionAge = Date.now() - parseInt(sessionTime);
    
    return sessionAge < SEVEN_DAYS;
  }

  saveRememberMe(email: string, password: string): void {
    localStorage.setItem(this.REMEMBER_KEY, JSON.stringify({ email, password }));
  }

  getRememberMe(): { email: string; password: string } | null {
    const saved = localStorage.getItem(this.REMEMBER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        localStorage.removeItem(this.REMEMBER_KEY);
      }
    }
    return null;
  }

  clearRememberMe(): void {
    localStorage.removeItem(this.REMEMBER_KEY);
  }

  clearAll(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REMEMBER_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem('gkt_daily_verse');
  }
}