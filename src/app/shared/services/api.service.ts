// shared/services/api.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = 'https://project.graylite.com/sinode/api.php';

  async post(action: string, data: any = {}): Promise<any> {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    return res.json();
  }

  async getAnnouncementsTicker(ccId: number) {
    return this.post('get_announcements_ticker', { cc_id: ccId });
  }

  async getAnnouncementsPosters(ccId: number) {
    return this.post('get_announcements_posters', { cc_id: ccId });
  }

  async getAllAnnouncements(ccId: number) {
    return this.post('get_all_announcements', { cc_id: ccId });
  }

  async getChurches() {
    return this.post('get_churches');
  }

  async updateChurch(mobId: number, ccId: number) {
    return this.post('update_cc_id', { mob_id: mobId, cc_id: ccId });
  }

  async getMobileNotifications(ccId: number) {
    return this.post('get_mobile_notifications', { cc_id: ccId });
  }
}