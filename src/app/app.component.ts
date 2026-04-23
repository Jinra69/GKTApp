import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import OneSignal from 'onesignal-cordova-plugin';
import { NavController, AlertController, ToastController, Platform, LoadingController } from '@ionic/angular';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor( private platform: Platform) {
      this.platform.ready().then(() => {
      this.setupPush();      
      // this.backgroundMode.enable();
    });
  }

  async setupPush() {
    OneSignal.Debug.setLogLevel(6);
    OneSignal.initialize("9f89194b-1136-43cc-ba31-c89e31fad5e7");

    // Handler saat notifikasi muncul ketika aplikasi sedang TERBUKA (Foreground)
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event:any) => {
        console.log('Notifikasi masuk di foreground:', event.notification);
        // Memaksa notifikasi tetap muncul (display)
        event.getNotification().display();
    });

    // Minta izin notifikasi
    await OneSignal.Notifications.requestPermission(true);
}
}
