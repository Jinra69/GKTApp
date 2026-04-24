// shared/services/onesignal.service.ts
import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import OneSignal from 'onesignal-cordova-plugin';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class OneSignalService {
  private playerId: string | null = null;

  constructor(
    private platform: Platform,
    private apiService: ApiService,
    private storage: StorageService
  ) {
    this.platform.ready().then(() => {
      this.setupPush();
    });
  }

  async setupPush() {
    try {
      console.log('Setting up OneSignal...');
      
      OneSignal.Debug.setLogLevel(6);
      OneSignal.initialize("9f89194b-1136-43cc-ba31-c89e31fad5e7");

      // Get player ID when available
      const playerId = await OneSignal.User.pushSubscription.getIdAsync();
      if (playerId) {
        this.playerId = playerId;
        console.log('OneSignal Player ID:', this.playerId);
        
        // Auto save if user is logged in
        const user = this.storage.getUser();
        if (user && user.mob_id) {
          await this.apiService.updatePlayerId(user.mob_id, playerId);
          console.log('Player ID saved for user:', user.mob_id);
        }
      }

      // Handler for foreground notifications
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('Notifikasi masuk di foreground:', event.notification);
        event.getNotification().display();
      });

      // Request permission
      await OneSignal.Notifications.requestPermission(true);
      
    } catch (error) {
      console.error('OneSignal setup error:', error);
    }
  }

  async getPlayerId(): Promise<string | null> {
    if (this.playerId) {
      return this.playerId;
    }
    
    try {
      const playerId = await OneSignal.User.pushSubscription.getIdAsync();
      if (playerId) {
        this.playerId = playerId;
        return playerId;
      }
    } catch (error) {
      console.error('Error getting player ID:', error);
    }
    
    return null;
  }

  async updateCurrentUserPlayerId(): Promise<boolean> {
    const user = this.storage.getUser();
    if (!user || !user.mob_id) {
      return false;
    }
    
    const playerId = await this.getPlayerId();
    if (!playerId) {
      return false;
    }
    
    try {
      const result = await this.apiService.updatePlayerId(user.mob_id, playerId);
      return result.success;
    } catch (error) {
      console.error('Error saving player ID:', error);
      return false;
    }
  }
}