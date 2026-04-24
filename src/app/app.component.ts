// app.component.ts
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { OneSignalService } from './shared/services/onesignal.service';
import { StorageService } from './shared/services/storage.service';
import { ApiService } from './shared/services/api.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private oneSignalService: OneSignalService,
    private storage: StorageService,
    private api: ApiService
  ) {
    this.platform.ready().then(() => {
      // Update player ID for logged in user on app start
      this.updatePlayerIdForLoggedInUser();
    });
  }

  private async updatePlayerIdForLoggedInUser() {
    // Check if user is logged in
    const user = this.storage.getUser();
    if (user && user.mob_id) {
      // Wait a bit for OneSignal to initialize
      setTimeout(async () => {
        await this.oneSignalService.updateCurrentUserPlayerId();
      }, 2000);
    }
  }
}