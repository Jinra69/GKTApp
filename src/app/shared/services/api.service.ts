// shared/services/api.service.ts
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = 'https://project.graylite.com/sinode/api.php';

  constructor(private storage: StorageService) {}

  async post(action: string, data: any = {}): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Add token if available
    const token = this.storage.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...data })
    });
    
    const result = await res.json();
    
    // If token is invalid, clear storage
    if (result.code === 401 || (result.message === 'Token tidak valid atau sudah kadaluwarsa.')) {
      this.storage.clearAll();
    }
    
    return result;
  }

  // Authentication methods
  async login(email: string, password: string): Promise<any> {
    return this.post('login', { email, password });
  }

  async register(name: string, email: string, phone: string, password: string, cc_id: number): Promise<any> {
    return this.post('register', { name, email, phone, password, cc_id });
  }

  async googleLogin(email: string, name: string): Promise<any> {
    return this.post('google_login', { email, name });
  }

  async checkEmail(email: string): Promise<any> {
    return this.post('check_email', { email });
  }

  async validateToken(): Promise<any> {
    return this.post('validate_token');
  }

  // Data methods
  async getChurches(): Promise<any> {
    return this.post('get_churches');
  }

  async getChurchesPublic(): Promise<any> {
    console.log('sadsadsa')
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_churchespublic' })
    });
    return res.json();
  }

  async getAnnouncementsTicker(ccId: number): Promise<any> {
    return this.post('get_announcements_ticker', { cc_id: ccId });
  }

  async getAnnouncementsPosters(ccId: number): Promise<any> {
    return this.post('get_announcements_posters', { cc_id: ccId });
  }

  async getAllAnnouncements(ccId: number): Promise<any> {
    return this.post('get_all_announcements', { cc_id: ccId });
  }
  
  async getRenungan(ccId: number): Promise<any> {
    return this.post('get_renungan', { cc_id: ccId });
  }
  async getMobileNotifications(ccId: number): Promise<any> {
    return this.post('get_mobile_notifications', { cc_id: ccId });
  }

  async updateChurch(mobId: number, ccId: number): Promise<any> {
    return this.post('update_cc_id', { mob_id: mobId, cc_id: ccId });
  }

  async updatePlayerId(mobId: number, playerId: string): Promise<any> {
    return this.post('update_player_id', { mob_id: mobId, player_id: playerId });
  }

  async sendOtp(email: string, name: string): Promise<any> {
    return this.post('send_otp', { email, name });
  }

  async verifyOtp(email: string, otpCode: string): Promise<any> {
    return this.post('verify_otp', { email, otp_code: otpCode });
  }
}