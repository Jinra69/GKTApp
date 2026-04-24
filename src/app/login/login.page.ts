// login/login.page.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  ToastController,
  LoadingController,
  AlertController
} from '@ionic/angular/standalone';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

import { StorageService } from '../shared/services/storage.service';
import { ApiService } from '../shared/services/api.service';
import { OneSignalService } from '../shared/services/onesignal.service';

interface Church {
  cc_id: number;
  cc_name: string;
}

interface PendingRegister {
  name: string;
  email: string;
  phone: string;
  password: string;
  ccId: number;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonInput, IonButton],
})
export class LoginPage implements OnInit, OnDestroy {
  // UI State
  isLogin: boolean = true;
  showOtpStep: boolean = false;
  showChurchPopup: boolean = false;

  // Form fields
  name: string = '';
  email: string = '';
  phone: string = '';
  password: string = '';

  // Church selection
  selectedCcId: number | null = null;
  selectedCcName: string = '';
  churches: Church[] = [];
  churchLoading: boolean = false;
  churchSearch: string = '';

  // Remember me
  rememberMe: boolean = false;

  // OTP
  otpCode: string = '';
  otpCountdown: number = 0;
  otpResendable: boolean = false;
  private countdownTimer: any = null;
  public pendingRegister: PendingRegister | null = null;

  // Google OAuth
  private readonly WEB_CLIENT_ID = '652723815945-q5m6hss5p6a6s6udi8puoqu0daqklk5c.apps.googleusercontent.com';
  private googleAuthInitialized: boolean = false;

  constructor(
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private oneSignalService: OneSignalService,
  ) {}

  async ngOnInit() {
    this.initGoogleAuth();
    await this.loadChurches();
    await this.checkExistingSession();
  }

  ngOnDestroy() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  // ========== SESSION MANAGEMENT ==========
  private async checkExistingSession() {
    if (this.storage.isSessionValid()) {
      const token = this.storage.getToken();
      if (token) {
        try {
          const res = await this.api.validateToken();
          if (res.success) {
            const user = this.storage.getUser();
            if (user && user.cc_id && user.cc_id !== 0) {
              await this.router.navigate(['/home'], { replaceUrl: true });
              return;
            }
          } else {
            this.storage.clearAll();
          }
        } catch {
          this.storage.clearAll();
        }
      }
    }

    // Hanya isi form dengan remember me, TAPI JANGAN auto login
    const savedCredentials = this.storage.getRememberMe();
    if (savedCredentials) {
      this.email = savedCredentials.email;
      this.password = savedCredentials.password;
      this.rememberMe = true;
      this.isLogin = true;
      this.cdr.detectChanges();
    }
  }

  // ========== GOOGLE AUTH ==========
  private initGoogleAuth() {
    // FIX: Pastikan initialize hanya dipanggil sekali
    if (this.googleAuthInitialized) return;

    try {
      GoogleAuth.initialize({
        clientId: this.WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
      this.googleAuthInitialized = true;
    } catch (err) {
      console.warn('GoogleAuth.initialize warning:', err);
    }
  }

  // ========== CHURCH MANAGEMENT ==========
  private async loadChurches() {
    this.churchLoading = true;
    this.cdr.detectChanges();

    try {
      const data = await this.api.getChurchesPublic();
      this.ngZone.run(() => {
        this.churches = (data.success && Array.isArray(data.data)) ? [...data.data] : [];
        this.churchLoading = false;
        this.cdr.detectChanges();
      });
    } catch (err) {
      this.ngZone.run(() => {
        this.churches = [];
        this.churchLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  get filteredChurches(): Church[] {
    const q = this.churchSearch.toLowerCase().trim();
    if (!q) return this.churches;
    return this.churches.filter(c => c.cc_name.toLowerCase().includes(q));
  }

  openChurchPopup() {
    this.ngZone.run(() => {
      this.churchSearch = '';
      this.showChurchPopup = true;
      this.cdr.detectChanges();
    });
  }

  closeChurchPopup() {
    this.ngZone.run(() => {
      this.showChurchPopup = false;
      this.cdr.detectChanges();
    });
  }

  selectChurch(church: Church) {
    this.ngZone.run(() => {
      this.selectedCcId = church.cc_id;
      this.selectedCcName = church.cc_name;
      this.showChurchPopup = false;
      this.churchSearch = '';
      this.cdr.detectChanges();
    });
  }

  // ========== UI HELPERS ==========
  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      cssClass: 'custom-toast'
    });
    await toast.present();
  }

  private async showLoading(message: string = 'Mohon tunggu...') {
    const loading = await this.loadingCtrl.create({ message, spinner: 'crescent' });
    await loading.present();
    return loading;
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  toggleRemember() {
    this.rememberMe = !this.rememberMe;
    if (!this.rememberMe) {
      this.storage.clearRememberMe();
    }
  }

  // ========== OTP MANAGEMENT ==========
  private startCountdown(seconds: number = 300) {
    this.otpCountdown = seconds;
    this.otpResendable = false;
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.otpCountdown--;
        if (this.otpCountdown <= 0) {
          clearInterval(this.countdownTimer);
          this.otpResendable = true;
        }
        this.cdr.detectChanges();
      });
    }, 1000);
  }

  get otpCountdownLabel(): string {
    const m = Math.floor(this.otpCountdown / 60).toString().padStart(2, '0');
    const s = (this.otpCountdown % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  cancelOtp() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.ngZone.run(() => {
      this.showOtpStep = false;
      this.otpCode = '';
      this.pendingRegister = null;
      this.cdr.detectChanges();
    });
  }

  async resendOtp() {
    if (!this.otpResendable || !this.pendingRegister) return;

    const loading = await this.showLoading('Mengirim ulang kode...');
    try {
      const res = await this.api.sendOtp(this.pendingRegister.email, this.pendingRegister.name);
      if (res.success) {
        this.startCountdown();
        await this.showToast('Kode OTP baru telah dikirim.', 'success');
      } else {
        await this.showToast(res.message || 'Gagal mengirim ulang kode.');
      }
    } catch {
      await this.showToast('Tidak dapat terhubung ke server.');
    } finally {
      await loading.dismiss();
    }
  }

  async verifyOtp() {
    const code = this.otpCode.trim();
    if (code.length !== 6) {
      await this.showToast('Masukkan 6 digit kode OTP.');
      return;
    }
    if (!this.pendingRegister) return;

    const loading = await this.showLoading('Memverifikasi kode...');
    try {
      const res = await this.api.verifyOtp(this.pendingRegister.email, code);

      if (!res.success) {
        await this.showToast(res.message || 'Kode OTP salah atau kedaluwarsa.');
        return;
      }

      await this.doRegister();
    } catch {
      await this.showToast('Tidak dapat terhubung ke server.');
    } finally {
      await loading.dismiss();
    }
  }

  private async doRegister() {
    if (!this.pendingRegister) return;
    const { name, email, phone, password, ccId } = this.pendingRegister;

    const loading = await this.showLoading('Mendaftarkan akun...');
    try {
      const res = await this.api.post('register', { name, email, phone, password, cc_id: ccId });

      if (res.success) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        await this.showToast('Akun berhasil dibuat! Silakan masuk. 🎉', 'success');

        this.ngZone.run(() => {
          this.name = '';
          this.phone = '';
          this.password = '';
          this.selectedCcId = null;
          this.selectedCcName = '';
          this.otpCode = '';
          this.showOtpStep = false;
          this.pendingRegister = null;
          this.isLogin = true;
          this.cdr.detectChanges();
        });
      } else {
        await this.showToast(res.message || 'Registrasi gagal. Coba lagi.');
      }
    } catch {
      await this.showToast('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      await loading.dismiss();
    }
  }

  // ========== LOGIN ==========
  async login() {
    const email = this.email.trim();
    const password = this.password.trim();

    if (!email || !password) {
      await this.showToast('Email dan password wajib diisi.');
      return;
    }
    if (!this.validateEmail(email)) {
      await this.showToast('Format email tidak valid.');
      return;
    }

    const loading = await this.showLoading('Masuk...');
    try {
      const res = await this.api.login(email, password);

      if (res.success) {
        if (res.token) {
          this.storage.setToken(res.token);
        }
        this.storage.setUser(res.data);

        await this.savePlayerId(res.data.mob_id);

        if (this.rememberMe) {
          this.storage.saveRememberMe(email, password);
        } else {
          this.storage.clearRememberMe();
        }

        await loading.dismiss();
        await this.showToast(`Selamat datang, ${res.data.user_name ?? 'Pengguna'}! 🎉`, 'success');
        this.router.navigate(['/home'], { replaceUrl: true });
      } else {
        await this.showToast(res.message || 'Login gagal. Periksa email dan password Anda.');
      }
    } catch (err) {
      console.error('Login error:', err);
      await this.showToast('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      await loading.dismiss();
    }
  }

  // ========== REGISTER ==========
  async register() {
    const name = this.name.trim();
    const email = this.email.trim();
    const phone = this.phone.trim();
    const password = this.password.trim();
    const ccId = this.selectedCcId;

    if (!name || !email || !phone || !password) {
      await this.showToast('Semua field wajib diisi.');
      return;
    }
    if (!ccId) {
      await this.showToast('Pilih gereja terlebih dahulu.');
      return;
    }
    if (!this.validateEmail(email)) {
      await this.showToast('Format email tidak valid.');
      return;
    }
    if (password.length < 6) {
      await this.showToast('Password minimal 6 karakter.');
      return;
    }

    // Check if email exists
    const checkLoading = await this.showLoading('Memeriksa data...');
    let emailExists = false;

    try {
      const checkRes = await this.api.checkEmail(email);
      emailExists = !!(checkRes.success && checkRes.data?.exists);
    } catch {
      await this.showToast('Tidak dapat terhubung ke server. Coba lagi.');
      return;
    } finally {
      await checkLoading.dismiss();
    }

    if (emailExists) {
      const alert = await this.alertCtrl.create({
        header: 'Email Sudah Terdaftar',
        message: `Email ${email} sudah digunakan. Silakan gunakan email lain atau masuk dengan akun yang sudah ada.`,
        buttons: [
          {
            text: 'Masuk Sekarang', handler: () => {
              this.isLogin = true;
              this.cdr.detectChanges();
            }
          },
          { text: 'Ganti Email', role: 'cancel' }
        ]
      });
      await alert.present();
      return;
    }

    // Send OTP
    const otpLoading = await this.showLoading('Mengirim kode verifikasi...');
    try {
      const otpRes = await this.api.sendOtp(email, name);

      if (!otpRes.success) {
        await this.showToast(otpRes.message || 'Gagal mengirim kode verifikasi.');
        return;
      }

      this.pendingRegister = { name, email, phone, password, ccId };
      this.ngZone.run(() => {
        this.otpCode = '';
        this.showOtpStep = true;
        this.startCountdown();
        this.cdr.detectChanges();
      });

      await this.showToast(`Kode verifikasi dikirim ke ${email}`, 'success');
    } catch {
      await this.showToast('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      await otpLoading.dismiss();
    }
  }

  // ========== LOGIN WITH GOOGLE ==========
  async loginWithGoogle() {
    const loading = await this.showLoading('Memproses akun Google...');
    let dismissed = false;

    const safeDismiss = async () => {
      if (!dismissed) {
        dismissed = true;
        await loading.dismiss();
      }
    };

    try {
      // FIX: Hapus this.initGoogleAuth() di sini — sudah dipanggil di ngOnInit
      // Memanggil initialize() lebih dari sekali bisa menyebabkan konflik state

      // Sign out dulu untuk paksa akun picker muncul
      try {
        await GoogleAuth.signOut();
      } catch {
        // Abaikan error sign out — tidak apa-apa jika belum login sebelumnya
      }

      const googleUser = await GoogleAuth.signIn();

      const email: string = (googleUser as any).email || (googleUser as any).profile?.email || '';
      const name: string = (googleUser as any).name || (googleUser as any).givenName || (googleUser as any).profile?.name || email;

      if (!email) {
        await safeDismiss();
        await this.showToast('Gagal mendapatkan email dari akun Google.');
        return;
      }

      const res = await this.api.googleLogin(email, name);

      if (res.success) {
        if (res.token) {
          this.storage.setToken(res.token);
        }
        this.storage.setUser(res.data);

        await safeDismiss();

        await this.oneSignalService.updateCurrentUserPlayerId();

        await this.showToast(`Selamat datang, ${res.data?.user_name ?? 'Pengguna'}! 🎉`, 'success');
        this.router.navigate(['/home'], { replaceUrl: true });
        return;
      } else {
        await this.showToast(res.message || 'Login Google gagal. Coba lagi.');
      }
    } catch (err: any) {
      // FIX: Log error detail agar mudah di-debug
      console.error('Google login error:', err);
      console.error('Google login error message:', err?.message);
      console.error('Google login error code:', err?.code);

      const errMsg = (err?.message ?? err?.code ?? '').toString();
      const isCancelled =
        errMsg === 'User cancelled' ||
        errMsg.includes('canceled') ||
        errMsg.includes('cancelled') ||
        errMsg.includes('12501') || // Google Sign-In cancel code Android
        errMsg.includes('popup_closed'); // Web cancel

      if (!isCancelled) {
        await this.showToast('Login Google gagal. Coba lagi.');
      }
    } finally {
      await safeDismiss();
    }
  }

  private async savePlayerId(mobId: number) {
    try {
      const playerId = await this.oneSignalService.getPlayerId();
      if (playerId) {
        await this.api.updatePlayerId(mobId, playerId);
        console.log('Player ID saved:', playerId);
      }
    } catch (error) {
      console.error('Failed to save player ID:', error);
    }
  }

  // ========== TRACKING FUNCTIONS ==========
  trackByChurch = (_: number, church: Church) => church.cc_id;
}