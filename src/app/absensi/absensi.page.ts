import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonTitle, IonToolbar,
  IonBackButton, IonButtons, IonContent, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, closeOutline, checkmarkCircleOutline, qrCodeOutline } from 'ionicons/icons';

// Plugin barcode scanner (install: npm i @capacitor-mlkit/barcode-scanning)
import {
  BarcodeScanner,
  BarcodeFormat,
} from '@capacitor-mlkit/barcode-scanning';

import { StorageService }   from '../shared/services/storage.service';
import { ApiService }       from '../shared/services/api.service';
import { OneSignalService } from '../shared/services/onesignal.service';
import { User }             from '../shared/interfaces/user.interface';

export interface HistoryAbsen {
  tanggal:   string;
  status:    string;
  statusKey: 'hadir' | 'terlambat' | 'izin' | 'alpha';
  waktu:     string;
}

@Component({
  selector: 'app-absensi',
  templateUrl: './absensi.page.html',
  styleUrls: ['./absensi.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonTitle, IonToolbar,
    IonBackButton, IonButtons, IonContent, IonIcon,
  ],
})
export class AbsensiPage implements OnInit, OnDestroy {

  // ── State ──────────────────────────────────────────────────────────────────
  activeTab: 'kamera' | 'qrcode' = 'kamera';
  historyOpen = false;

  // User
  user: User | null = null;

  // QR (tab QR Code — untuk menampilkan QR milik user sendiri)
  personId:   string | null = null;
  qrImageUrl: string | null = null;
  qrLoading  = false;
  qrError    = false;

  // Popup (ditampilkan setelah QR di-scan)
  popupOpen = false;
  popupId:  string | null = null;

  // Scanner state
  scannerActive  = false;
  scannerLoading = false;
  scanResult:    string | null = null;

  // History
  historyAbsen:   HistoryAbsen[] = [];
  historyLoading = false;

  constructor(
    private storage:   StorageService,
    private api:       ApiService,
    private oneSignal: OneSignalService,
  ) {
    addIcons({ timeOutline, closeOutline, checkmarkCircleOutline, qrCodeOutline });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async ngOnInit() {
    this.user = this.storage.getUser();
    if (this.user) {
      await Promise.all([
        this.loadQrData(),
        this.loadHistory(),
      ]);
    }
    // Langsung buka scanner saat halaman dibuka
    await this.startBarcodeScan();
  }

  ngOnDestroy() {
    // Pastikan scanner ditutup saat keluar dari halaman
    this.stopScan();
  }

  // ── Barcode Scanner ────────────────────────────────────────────────────────
  async startBarcodeScan() {
    if (this.scannerActive || this.scannerLoading) return;

    // Cek & minta izin kamera
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera === 'denied') {
      console.warn('[Scanner] Izin kamera ditolak');
      return;
    }
    if (camera !== 'granted') {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== 'granted') {
        console.warn('[Scanner] User menolak izin kamera');
        return;
      }
    }

    this.scannerLoading = true;
    this.scanResult     = null;

    try {
      this.scannerActive = true;

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });

      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue;
        console.log('[Scanner] Hasil scan:', value);
        if (value) {
          await this.onScanSuccess(value);
        }
      }
    } catch (err: any) {
      if (err?.message !== 'scan cancelled') {
        console.error('[Scanner] Error:', err);
      }
    } finally {
      this.scannerActive  = false;
      this.scannerLoading = false;
    }
  }

  async stopScan() {
    if (this.scannerActive) {
      try { await BarcodeScanner.stopScan(); } catch { /* ignore */ }
      this.scannerActive = false;
    }
  }

  /** Dipanggil setelah QR berhasil di-scan */
  async onScanSuccess(rawValue: string) {
    this.scanResult = rawValue;

    // TODO: kirim ke API untuk verifikasi & catat absensi
    // const res = await this.api.post('absensi_scan', { mob_id: this.user?.mob_id, qr_value: rawValue });

    // Tampilkan popup konfirmasi
    this.popupId   = rawValue;
    this.popupOpen = true;
  }

  // ── QR (tab QR Code milik user) ────────────────────────────────────────────
  /**
   * POST action: get_absensi_qr
   * Kirim  : { mob_id }
   * Terima : { success, data: { person_id, qr_url } }
   */
  async loadQrData() {
    if (!this.user) return;
    this.qrLoading = true;
    this.qrError   = false;
    try {
      console.log('[QR] Token:', this.storage.getToken());
      const res = await this.api.post('get_absensi_qr', {});
      console.log('[QR DEBUG] Response:', JSON.stringify(res));
      if (res.success) {
        this.personId   = res.data.person_id;
        this.qrImageUrl = res.data.qr_url;
      } else {
        this.qrError = true;
      }
    } catch (err) {
      console.error('[QR] Error:', err);
      this.qrError = true;
    } finally {
      this.qrLoading = false;
    }
  }

  retryQr() {
    this.loadQrData();
  }

  // ── History ────────────────────────────────────────────────────────────────
  /**
   * POST action: get_history_absen
   * Kirim  : { mob_id }
   * Terima : { success, data: HistoryAbsen[] }
   */
  async loadHistory() {
    if (!this.user) return;
    this.historyLoading = true;
    try {
      const res = await this.api.post('get_history_absen', {});
      if (res.success && Array.isArray(res.data)) {
        this.historyAbsen = res.data;
      }
    } catch {
      // biarkan array kosong
    } finally {
      this.historyLoading = false;
    }
  }

  toggleHistory() {
    this.historyOpen = !this.historyOpen;
  }

  // ── Tab ────────────────────────────────────────────────────────────────────
  async switchTab(tab: 'kamera' | 'qrcode') {
    this.activeTab = tab;
    if (tab === 'kamera') {
      // Kembali ke tab kamera → langsung buka scanner lagi
      await this.startBarcodeScan();
    } else {
      // Pindah ke tab QR Code → hentikan scanner
      await this.stopScan();
      if (!this.qrImageUrl && !this.qrLoading) {
        this.loadQrData();
      }
    }
  }

  // ── Popup ──────────────────────────────────────────────────────────────────
  closePopup() {
    this.popupOpen  = false;
    this.popupId    = null;
    this.scanResult = null;
    // Scan ulang setelah popup ditutup
    if (this.activeTab === 'kamera') {
      this.startBarcodeScan();
    }
  }

  // ── Dev only ───────────────────────────────────────────────────────────────
  showScanResult() {
    if (!this.personId) return;
    this.popupId   = this.personId;
    this.popupOpen = true;
  }
}