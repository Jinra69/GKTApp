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
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton
  ],
})
export class LoginPage implements OnInit, OnDestroy {

  isLogin: boolean = true;

  name: string     = '';
  email: string    = '';
  phone: string    = '';
  password: string = '';

  // ── Pilih Gereja ─────────────────────────
  selectedCcId:    number | null = null;
  selectedCcName:  string        = '';
  churches:        { cc_id: number; cc_name: string }[] = [];
  churchLoading    = false;
  showChurchPopup  = false;
  churchSearch     = '';

  // ── Simpan Akun ──────────────────────────
  rememberMe: boolean = false;
  private readonly REMEMBER_KEY = 'gkt_remember';

  private apiUrl = 'https://project.graylite.com/sinode/api.php';
  private otpUrl = 'https://project.graylite.com/sinode/otp.php';

  // ── Web OAuth Client ID (untuk GoogleAuth.initialize) ──
  private readonly WEB_CLIENT_ID =
    '652723815945-q5m6hss5p6a6s6udi8puoqu0daqklk5c.apps.googleusercontent.com';

  // ── Step OTP ─────────────────────────────
  showOtpStep   = false;
  otpCode       = '';
  otpCountdown  = 0;
  otpResendable = false;
  private countdownTimer: any = null;

  // Simpan data register sementara selama OTP
  pendingRegister: {
    name: string; email: string; phone: string; password: string; ccId: number;
  } | null = null;

  constructor(
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.initGoogleAuth();

    const saved = localStorage.getItem(this.REMEMBER_KEY);
    if (saved) {
      try {
        const { email, password } = JSON.parse(saved);
        this.email      = email    || '';
        this.password   = password || '';
        this.rememberMe = true;
        this.isLogin    = true;
      } catch {
        localStorage.removeItem(this.REMEMBER_KEY);
      }
    }

    this.loadChurches();
  }

  private initGoogleAuth() {
    try {
      GoogleAuth.initialize({
        clientId: this.WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
    } catch (err) {
      console.warn('GoogleAuth.initialize warning:', err);
    }
  }

  async loadChurches() {
    this.churchLoading = true;

    try {
      const res  = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_churches' })
      });
      const data = await res.json();

      const list = (data.success && Array.isArray(data.data)) ? [...data.data] : [];

      setTimeout(() => {
        this.ngZone.run(() => {
          this.churches      = list;
          this.churchLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }, 0);

    } catch (err) {
      console.warn('Gagal memuat daftar gereja:', err);
      setTimeout(() => {
        this.ngZone.run(() => {
          this.churches      = [];
          this.churchLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }, 0);
    }
  }

  get filteredChurches() {
    const q = this.churchSearch.toLowerCase().trim();
    if (!q) return this.churches;
    return this.churches.filter(c => c.cc_name.toLowerCase().includes(q));
  }

  openChurchPopup() {
    this.ngZone.run(() => {
      this.churchSearch    = '';
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

  selectChurch(church: { cc_id: number; cc_name: string }) {
    this.ngZone.run(() => {
      this.selectedCcId    = church.cc_id;
      this.selectedCcName  = church.cc_name;
      this.showChurchPopup = false;
      this.churchSearch    = '';
      this.cdr.detectChanges();
    });
  }

  toggleRemember() {
    this.rememberMe = !this.rememberMe;
    if (!this.rememberMe) localStorage.removeItem(this.REMEMBER_KEY);
  }

  // ── Helpers ──────────────────────────────
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

  private async callApi(action: string, body: object): Promise<any> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body })
    });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return response.json();
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async callOtp(action: string, body: object): Promise<any> {
    const response = await fetch(this.otpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body })
    });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    return response.json();
  }

  // ── OTP Countdown (5 menit = 300 detik) ──
  private startCountdown(seconds = 300) {
    this.otpCountdown  = seconds;
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
      this.showOtpStep      = false;
      this.otpCode          = '';
      this.pendingRegister  = null;
      this.cdr.detectChanges();
    });
  }

  async resendOtp() {
    if (!this.otpResendable || !this.pendingRegister) return;
    const loading = await this.showLoading('Mengirim ulang kode...');
    try {
      const res = await this.callOtp('send_otp', {
        email: this.pendingRegister.email,
        name:  this.pendingRegister.name
      });
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
    if (code.length !== 6) { await this.showToast('Masukkan 6 digit kode OTP.'); return; }
    if (!this.pendingRegister) return;

    const loading = await this.showLoading('Memverifikasi kode...');
    let dismissed = false;

    const safeDismiss = async () => {
      if (!dismissed) {
        dismissed = true;
        await loading.dismiss();
      }
    };

    try {
      const res = await this.callOtp('verify_otp', {
        email:    this.pendingRegister.email,
        otp_code: code
      });

      if (!res.success) {
        await safeDismiss();
        await this.showToast(res.message || 'Kode OTP salah atau kedaluwarsa.');
        return;
      }

      await safeDismiss();
      await this.doRegister();

    } catch {
      await this.showToast('Tidak dapat terhubung ke server.');
    } finally {
      await safeDismiss();
    }
  }

  private async doRegister() {
    if (!this.pendingRegister) return;
    const { name, email, phone, password, ccId } = this.pendingRegister;

    const regLoading = await this.showLoading('Mendaftarkan akun...');
    try {
      const regRes = await this.callApi('register', { name, email, phone, password, cc_id: ccId });

      if (regRes.success) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        await this.showToast('Akun berhasil dibuat! Silakan masuk. 🎉', 'success');
        this.ngZone.run(() => {
          this.name            = '';
          this.phone           = '';
          this.password        = '';
          this.selectedCcId    = null;
          this.selectedCcName  = '';
          this.otpCode         = '';
          this.showOtpStep     = false;
          this.pendingRegister = null;
          this.isLogin         = true;
          this.cdr.detectChanges();
        });
      } else {
        await this.showToast(regRes.message || 'Registrasi gagal. Coba lagi.');
      }
    } catch {
      await this.showToast('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      await regLoading.dismiss();
    }
  }

  // ── LOGIN ────────────────────────────────
  async login() {
    const email    = this.email.trim();
    const password = this.password.trim();
    if (!email || !password) { await this.showToast('Email dan password wajib diisi.'); return; }
    if (!this.validateEmail(email)) { await this.showToast('Format email tidak valid.'); return; }

    const loading = await this.showLoading('Masuk...');
    let dismissed = false;
    const safeDismiss = async () => {
      if (!dismissed) { dismissed = true; await loading.dismiss(); }
    };

    try {
      const res = await this.callApi('login', { email, password });
      if (res.success) {
        localStorage.setItem('user', JSON.stringify(res.data));
        if (this.rememberMe) {
          localStorage.setItem(this.REMEMBER_KEY, JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem(this.REMEMBER_KEY);
        }
        await safeDismiss(); // ← dismiss SEBELUM navigate
        await this.showToast(`Selamat datang, ${res.data.user_name ?? 'Pengguna'}! 🎉`, 'success');
        this.router.navigate(['/home'], { replaceUrl: true });
        return;
      } else {
        await this.showToast(res.message || 'Login gagal. Periksa email dan password Anda.');
      }
    } catch (err) {
      console.error('Login error:', err);
      await this.showToast('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      await safeDismiss();
    }
  }

  // ── REGISTER — Step 1: validasi & kirim OTP ──
  async register() {
    const name     = this.name.trim();
    const email    = this.email.trim();
    const phone    = this.phone.trim();
    const password = this.password.trim();
    const ccId     = this.selectedCcId;

    if (!name || !email || !phone || !password) { await this.showToast('Semua field wajib diisi.'); return; }
    if (!ccId)                                   { await this.showToast('Pilih gereja terlebih dahulu.'); return; }
    if (!this.validateEmail(email))              { await this.showToast('Format email tidak valid.'); return; }
    if (password.length < 6)                     { await this.showToast('Password minimal 6 karakter.'); return; }

    const checkLoading = await this.showLoading('Memeriksa data...');
    let emailExists    = false;
    try {
      const checkRes = await this.callApi('check_email', { email });
      emailExists    = !!(checkRes.success && checkRes.data?.exists);
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
          { text: 'Masuk Sekarang', handler: () => { this.isLogin = true; } },
          { text: 'Ganti Email',    role: 'cancel' }
        ]
      });
      await alert.present();
      return;
    }

    const otpLoading = await this.showLoading('Mengirim kode verifikasi...');
    try {
      const otpRes = await this.callOtp('send_otp', { email, name });
      if (!otpRes.success) {
        await this.showToast(otpRes.message || 'Gagal mengirim kode verifikasi.');
        return;
      }

      this.pendingRegister = { name, email, phone, password, ccId };
      this.ngZone.run(() => {
        this.otpCode     = '';
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

  // ── LOGIN WITH GOOGLE ─────────────────────
  async loginWithGoogle() {
    const loading = await this.showLoading('Memproses akun Google...');
    let dismissed = false;

    // FIX: gunakan safeDismiss agar tidak double-dismiss saat navigate
    const safeDismiss = async () => {
      if (!dismissed) { dismissed = true; await loading.dismiss(); }
    };

    try {
      this.initGoogleAuth();

      try {
        await GoogleAuth.signOut();
      } catch {
        // Abaikan jika belum pernah login sebelumnya
      }

      const googleUser = await GoogleAuth.signIn();

      // FIX: ambil email dari berbagai kemungkinan struktur response Capacitor GoogleAuth
      const email: string =
        (googleUser as any).email ||
        (googleUser as any).profile?.email ||
        '';

      const name: string =
        (googleUser as any).name ||
        (googleUser as any).givenName ||
        (googleUser as any).profile?.name ||
        email;

      if (!email) {
        await this.showToast('Gagal mendapatkan email dari akun Google.');
        return;
      }

      const res = await this.callApi('google_login', { email, name });

      if (res.success) {
        localStorage.setItem('user', JSON.stringify(res.data));
        await safeDismiss(); // FIX: dismiss SEBELUM navigate agar tidak race condition
        await this.showToast(`Selamat datang, ${res.data?.user_name ?? 'Pengguna'}! 🎉`, 'success');
        this.router.navigate(['/home'], { replaceUrl: true });
        return;
      } else {
        await this.showToast(res.message || 'Login Google gagal. Coba lagi.');
      }

    } catch (err: any) {
      console.error('Google login error:', JSON.stringify(err));

      const errMsg  = (err?.message || '').toString();
      const errCode = (err?.error   || '').toString();
      const errNum  = (err?.code    || '').toString();

      const isCancelled =
        errCode === 'popup_closed_by_user'          ||
        errMsg  === 'User cancelled'                ||
        errMsg  === 'The user canceled the sign-in flow.' ||
        errNum  === '12501'                         ||
        errMsg.includes('canceled')                 ||
        errMsg.includes('cancelled');

      if (!isCancelled) {
        if (errNum === '12500' || errMsg.includes('DEVELOPER_ERROR')) {
          await this.showToast('Konfigurasi Google Sign-In bermasalah. Hubungi admin.');
        } else {
          await this.showToast('Login Google gagal. Coba lagi.');
        }
      }

    } finally {
      await safeDismiss();
    }
  }

  ngOnDestroy() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }
}