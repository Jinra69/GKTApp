// home/home.page.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- TAMBAHKAN INI
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, chevronForwardOutline, gridOutline, arrowBackOutline } from 'ionicons/icons';
import { LocalNotifications } from '@capacitor/local-notifications';

import { ApiService } from '../shared/services/api.service';
import { VerseService } from '../shared/services/verse.service';
import { StorageService } from '../shared/services/storage.service';
import { AnnouncementTickerComponent } from '../components/pengumuman-ticker/pengumuman-ticker.component';
import { PosterSliderComponent } from '../components/poster-slider/poster-slider.component';
import { Announcement, Poster, MobileNotif } from '../shared/interfaces/pengumuman.interface';
import { MenuItem, MenuGroup, User, Church } from '../shared/interfaces/user.interface';
import { Verse } from '../shared/interfaces/verse.interface';
import { OneSignalService } from '../shared/services/onesignal.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    FormsModule,  // <-- TAMBAHKAN FORMSMODULE DI SINI
    IonContent, 
    IonIcon, 
    AnnouncementTickerComponent, 
    PosterSliderComponent
  ],
})
export class HomePage implements OnInit, OnDestroy {
  // ... semua properti tetap sama ...
  userName = 'Saudara';
  userCcId: number | null = null;

  // Announcements
  announcements: Announcement[] = [];
  announcementsLoading = true;

  // Posters
  posters: Poster[] = [];
  postersLoading = false;

  // Verse
  verseText = '';
  verseRef = '';
  verseLoading = true;
  showVersePopup = false;
  verseCopied = false;

  // Popups
  showPopup = false;
  popupTitle = '';
  popupBody = '';

  showMenuPopup = false;
  selectedMenu: MenuItem | null = null;
  showAllMenus = false;
  showProfilePopup = false;

  // Church selector
  showChurchPopup = false;
  showChurchConfirm = false;
  churches: Church[] = [];
  churchesLoading = false;
  selectedChurchId: number | null = null;
  selectedChurchName = '';
  churchSaving = false;
  churchSaveError = '';
  churchSearchQuery = '';
  filteredChurches: Church[] = [];

  // Poster zoom
  showPosterZoom = false;
  posterZoomUrl = '';
  posterZoomScale = 1;
  private pzLastTouchDist = 0;
  private pzStartScale = 1;
  private pzLastTap = 0;

  // Menu data
  menuItems: MenuItem[] = [
    { icon: '📣', name: 'Pengumuman', desc: 'Info & berita', bg: '#FFF0EB', detail: '', action: 'pengumuman' },
    { icon: '📖', name: 'Firman', desc: 'Renungan harian', bg: '#FFF7EB', detail: 'Baca renungan harian, khotbah mingguan, dan materi PA yang disiapkan hamba Tuhan GKT.', action: '' },
    { icon: '🎵', name: 'Pujian', desc: 'Lagu & lirik', bg: '#EBFFF4', detail: 'Koleksi lagu pujian lengkap dengan lirik, not balok, dan panduan tim musik.', action: '' },
    { icon: '💰', name: 'Absensi', desc: 'Absensi Jemaat', bg: '#FFEBF4', detail: 'Absensi ibadah umum, pemuda, remaja, sekolah minggu', action: 'absensi' },
    { icon: '📅', name: 'Kalender', desc: 'Agenda gereja', bg: '#F4EBFF', detail: 'Lihat agenda dan kalender kegiatan gereja sepanjang tahun.', action: '' },
  ];

  menuGroups: MenuGroup[] = [
    { label: 'Ibadah & Rohani', items: [
      { icon: '🙏', name: 'Ibadah', bg: '#EBF4FF', detail: 'Jadwal & streaming ibadah mingguan.', desc : '' },
      { icon: '📖', name: 'Firman', bg: '#FFF7EB', detail: 'Renungan harian dan khotbah.', desc : ''  },
      { icon: '🎵', name: 'Pujian', bg: '#EBFFF4', detail: 'Lagu pujian dan lirik.', desc : ''  },
      { icon: '🕯️', name: 'Doa', bg: '#F4EBFF', detail: 'Jadwal doa bersama dan topik doa.', desc : ''  },
      { icon: '✝️', name: 'Sakramen', bg: '#FFEBEB', detail: 'Info Baptis, Sidi, dan Perjamuan.', desc : ''  },
      { icon: '📿', name: 'Katekisasi', bg: '#EBFBFF', detail: 'Materi dan jadwal kelas katekisasi.', desc : ''  },
      { icon: '🎙️', name: 'Khotbah', bg: '#FFFBEB', detail: 'Arsip rekaman khotbah mingguan.', desc : ''  },
      { icon: '📻', name: 'Live Stream', bg: '#EBFFFC', detail: 'Tonton ibadah secara langsung.', desc : ''  },
      { icon: '🗓️', name: 'Liturgi', bg: '#F0EBFF', detail: 'Tata ibadah dan liturgi minggu ini.', desc : ''  },
      { icon: '🌿', name: 'PA Online', bg: '#EBFFF0', detail: 'Pendalaman Alkitab online.', desc : ''  },
    ]},
    { label: 'Jemaat & Pelayanan', items: [
      { icon: '👥', name: 'Komsel', bg: '#F4EBFF', detail: 'Kelompok sel di wilayah Anda.', desc : ''  },
      { icon: '💰', name: 'Absensi', bg: '#FFEBEB', detail: 'Persembahan dan perpuluhan online.', desc : ''  },
      { icon: '📞', name: 'Kontak', bg: '#FFFBEB', detail: 'Hubungi majelis dan pendeta.', desc : ''  },
      { icon: '📰', name: 'Warta', bg: '#EBFFFC', detail: 'Warta jemaat mingguan.', desc : ''  },
      { icon: '🤝', name: 'Diakonia', bg: '#EBF4FF', detail: 'Program sosial dan pelayanan kasih.', desc : ''  },
      { icon: '👶', name: 'Sekolah Minggu', bg: '#FFF7EB', detail: 'Kegiatan anak-anak Sekolah Minggu.', desc : ''  },
      { icon: '🧑‍🤝‍🧑', name: 'Pemuda', bg: '#EBFFF4', detail: 'Persekutuan dan kegiatan pemuda.', desc : ''  },
      { icon: '👩', name: 'Wanita', bg: '#FFEBF4', detail: 'Persekutuan wanita GKT.', desc : ''  },
      { icon: '👨', name: 'Pria', bg: '#EBEFFF', detail: 'Persekutuan pria dewasa GKT.', desc : ''  },
      { icon: '👴', name: 'Lansia', bg: '#FFF9EB', detail: 'Kegiatan dan pelayanan lansia.', desc : ''  },
    ]},
    { label: 'Info & Administrasi', items: [
      { icon: '📅', name: 'Kalender', bg: '#EBFBFF', detail: 'Agenda gereja sepanjang tahun.', desc : ''  },
      { icon: '🗺️', name: 'Lokasi', bg: '#EBFFFC', detail: 'Alamat dan peta lokasi gereja.', desc : ''  },
      { icon: '📋', name: 'Formulir', bg: '#FFF7EB', detail: 'Download formulir pelayanan.', desc : ''  },
      { icon: '📊', name: 'Laporan', bg: '#F4EBFF', detail: 'Laporan keuangan dan kegiatan.', desc : '' },
      { icon: '📷', name: 'Galeri', bg: '#EBFFF4', detail: 'Foto dan dokumentasi kegiatan.', desc : ''  },
      { icon: '📣', name: 'Pengumuman', bg: '#FFEBEB', detail: 'Semua pengumuman jemaat.', desc : ''  },
      { icon: '🎓', name: 'Seminar', bg: '#EBF4FF', detail: 'Pendaftaran dan info seminar.', desc : ''  },
      { icon: '💌', name: 'Surat', bg: '#FFFBEB', detail: 'Surat dan notifikasi resmi gereja.', desc : ''  },
      { icon: '⚙️', name: 'Pengaturan', bg: '#F0EBFF', detail: 'Atur preferensi akun Anda.', desc : ''  },
      { icon: '❓', name: 'Bantuan', bg: '#EBEFFF', detail: 'FAQ dan pusat bantuan.', desc : ''  },
    ]}
  ];

  private backButtonListener: any;

  constructor(
    private router: Router,
    private api: ApiService,
    private verseService: VerseService,
    private storage: StorageService,
    private oneSignalService: OneSignalService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    addIcons({ megaphoneOutline, chevronForwardOutline, gridOutline, arrowBackOutline });
  }

  async ngOnInit() {
    // Validate token first
    const isValid = await this.validateToken();
    if (!isValid) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    const user = this.storage.getUser();
    if (user) {
      this.userName = user.user_name;
      this.userCcId = user.cc_id;
      await this.updatePlayerId(user.mob_id);
    }

    this.disableAndroidBackButton();

    if (!this.userCcId || this.userCcId === 0) {
      this.showChurchPopup = true;
      this.loadChurches();
    } else {
      this.loadAnnouncements();
      this.loadPosters();
      this.sendWelcomeNotification();
    }

    const verse = await this.verseService.loadDailyVerse();
    this.verseText = verse.text;
    this.verseRef = verse.ref;
    this.verseLoading = false;
    this.cdr.markForCheck();
  }

  // 🔥 METHOD UPDATE PLAYER ID 🔥
  private async updatePlayerId(mobId: number) {
    try {
      const playerId = await this.oneSignalService.getPlayerId();
      if (playerId) {
        console.log('Player ID : '+playerId)
        const result = await this.api.updatePlayerId(mobId, playerId);
        if (result.success) {
          console.log('Player ID updated in home page');
        }
      }
    } catch (error) {
      console.error('Failed to update player ID in home page:', error);
    }
  }

  private async validateToken(): Promise<boolean> {
    try {
      const res = await this.api.validateToken();
      if (res.success) {
        return true;
      }
    } catch (err) {
      console.error('Token validation failed:', err);
    }
    
    this.storage.clearAll();
    return false;
  }

  ngOnDestroy() {
    if (this.backButtonListener) this.backButtonListener.remove();
  }

  private async loadAnnouncements() {
    if (!this.userCcId) return;
    try {
      const data = await this.api.getAnnouncementsTicker(this.userCcId);
      this.ngZone.run(() => {
        if (data.success && data.data?.length) this.announcements = data.data;
        this.announcementsLoading = false;
        this.cdr.markForCheck();
      });
    } catch {
      this.ngZone.run(() => { this.announcementsLoading = false; this.cdr.markForCheck(); });
    }
  }

  private async loadPosters() {
    if (!this.userCcId) return;
    this.postersLoading = true;
    try {
      const data = await this.api.getAnnouncementsPosters(this.userCcId);
      this.ngZone.run(() => {
        if (data.success && data.data?.length) {
          this.posters = data.data.map((p: any) => ({ src: p.file_image, alt: 'Poster', caption: '' }));
        }
        this.postersLoading = false;
        this.cdr.markForCheck();
      });
    } catch {
      this.ngZone.run(() => { this.postersLoading = false; this.cdr.markForCheck(); });
    }
  }

  private async loadChurches() {
    this.churchesLoading = true;
    try {
      const data = await this.api.getChurches();
      this.ngZone.run(() => {
        if (data.success && data.data?.length) {
          this.churches = data.data;
          this.filteredChurches = [...this.churches];
        }
        this.churchesLoading = false;
        this.cdr.markForCheck();
      });
    } catch {
      this.ngZone.run(() => { this.churchesLoading = false; this.cdr.markForCheck(); });
    }
  }

  onChurchSearchChange() {
    const q = this.churchSearchQuery.trim().toLowerCase();
    this.filteredChurches = q ? this.churches.filter(c => c.cc_name.toLowerCase().includes(q)) : [...this.churches];
    this.cdr.markForCheck();
  }

  selectChurch(ccId: number) {
    this.selectedChurchId = ccId;
    this.selectedChurchName = this.churches.find(c => c.cc_id === ccId)?.cc_name ?? '';
    this.churchSaveError = '';
    this.cdr.markForCheck();
  }

  askConfirmChurch() {
    if (!this.selectedChurchId) {
      this.churchSaveError = 'Silakan pilih gereja terlebih dahulu.';
      return;
    }
    this.showChurchConfirm = true;
    this.cdr.markForCheck();
  }

  cancelConfirmChurch() { this.showChurchConfirm = false; this.cdr.markForCheck(); }

  async confirmChurch() {
    if (!this.selectedChurchId) return;
    this.churchSaving = true;
    this.churchSaveError = '';
    this.cdr.markForCheck();

    try {
      const user = this.storage.getUser();
      if (!user) throw new Error('Session tidak ditemukan.');
      
      const data = await this.api.updateChurch(user.mob_id, this.selectedChurchId);
      
      this.ngZone.run(() => {
        if (data.success) {
          user.cc_id = this.selectedChurchId!;
          this.userCcId = this.selectedChurchId;
          this.storage.setUser(user);
          this.showChurchPopup = false;
          this.showChurchConfirm = false;
          this.loadAnnouncements();
          this.loadPosters();
        } else {
          this.churchSaveError = data.message || 'Gagal menyimpan.';
        }
        this.churchSaving = false;
        this.cdr.markForCheck();
      });
    } catch {
      this.ngZone.run(() => {
        this.churchSaveError = 'Terjadi kesalahan. Periksa koneksi Anda.';
        this.churchSaving = false;
        this.cdr.markForCheck();
      });
    }
  }

  onAnnouncementClick(announcement: Announcement) {
    this.popupTitle = announcement.noun_title;
    this.popupBody = announcement.noun_desc ?? 'Tidak ada detail pengumuman.';
    this.showPopup = true;
    this.cdr.markForCheck();
  }

  closePopup() { this.showPopup = false; this.cdr.markForCheck(); }

  get formattedPopupBody(): string {
    return this.popupBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  openMenu(item: MenuItem) {
    console.log(item.action)
    if (item.action === 'pengumuman') {
      this.router.navigate(['/pengumuman']);
      return;
    }
    if (item.action === 'absensi') {
      this.router.navigate(['/absensi']);
      return;
    }
    this.selectedMenu = item;
    this.showMenuPopup = true;
    this.cdr.markForCheck();
  }

  closeMenuPopup() { this.showMenuPopup = false; this.selectedMenu = null; this.cdr.markForCheck(); }
  openAllMenus() { this.showAllMenus = true; this.cdr.markForCheck(); }
  closeAllMenus() { this.showAllMenus = false; this.cdr.markForCheck(); }
  openProfilePopup() { this.showProfilePopup = true; this.cdr.markForCheck(); }
  closeProfilePopup() { this.showProfilePopup = false; this.cdr.markForCheck(); }
  changePassword() { this.closeProfilePopup(); }

  openVersePopup() { this.showVersePopup = true; this.cdr.markForCheck(); }
  closeVersePopup() { this.showVersePopup = false; this.verseCopied = false; this.cdr.markForCheck(); }

  copyVerse() {
    const text = `"${this.verseText}" — ${this.verseRef}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.verseCopied = true;
        setTimeout(() => { this.verseCopied = false; this.cdr.markForCheck(); }, 2500);
      });
    }
  }

  openPosterZoom(url: string) {
    this.posterZoomUrl = url;
    this.posterZoomScale = 1;
    this.showPosterZoom = true;
    this.cdr.markForCheck();
  }

  closePosterZoom() {
    this.showPosterZoom = false;
    this.posterZoomUrl = '';
    this.posterZoomScale = 1;
    this.cdr.markForCheck();
  }

  pzZoomIn() { this.posterZoomScale = Math.min(4, +(this.posterZoomScale + 0.5).toFixed(1)); this.cdr.markForCheck(); }
  pzZoomOut() { this.posterZoomScale = Math.max(1, +(this.posterZoomScale - 0.5).toFixed(1)); this.cdr.markForCheck(); }
  pzReset() { this.posterZoomScale = 1; this.cdr.markForCheck(); }

  onPzTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      this.pzLastTouchDist = this.getTouchDist(e);
      this.pzStartScale = this.posterZoomScale;
    }
    const now = Date.now();
    if (now - this.pzLastTap < 300) this.posterZoomScale = this.posterZoomScale > 1 ? 1 : 2;
    this.pzLastTap = now;
  }

  onPzTouchMove(e: TouchEvent) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const ratio = this.getTouchDist(e) / this.pzLastTouchDist;
    this.posterZoomScale = Math.min(4, Math.max(1, +(this.pzStartScale * ratio).toFixed(2)));
    this.cdr.markForCheck();
  }

  private getTouchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  logout() {
    // Clear all localStorage data
    this.storage.clearAll();
    
    // Close popup
    this.closeProfilePopup();
    
    // Navigate to login tanpa replaceUrl agar bisa back button?
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private disableAndroidBackButton() {
    import('@capacitor/app').then(({ App }) => {
      this.backButtonListener = App.addListener('backButton', () => {
        if (this.showChurchPopup) return;
        if (this.showPosterZoom) { this.closePosterZoom(); return; }
        if (this.showProfilePopup) { this.closeProfilePopup(); return; }
        if (this.showVersePopup) { this.closeVersePopup(); return; }
        if (this.showMenuPopup) { this.closeMenuPopup(); return; }
        if (this.showPopup) { this.closePopup(); return; }
        if (this.showAllMenus) { this.closeAllMenus(); return; }
      });
    }).catch(() => {});
  }

  private async sendWelcomeNotification() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      if (display !== 'granted') return;

      let notifs: MobileNotif[] = [];
      try {
        const data = await this.api.getMobileNotifications(this.userCcId!);
        if (data.success && data.data?.length) notifs = data.data;
      } catch {}

      if (notifs.length === 0) {
        notifs = [{ noun_id: 0, noun_notif: `Selamat datang, ${this.userName}! 🙏 Tuhan memberkati hari ini.` }];
      }

      await LocalNotifications.schedule({
        notifications: notifs.map((n, i) => ({
          id: 1001 + i,
          title: 'GKT Sinode',
          body: n.noun_notif,
          schedule: { at: new Date(Date.now() + 1500 + i * 1500) },
          smallIcon: 'ic_stat_icon_config_sample',
          actionTypeId: '',
          extra: null,
        }))
      });
    } catch {}
  }

  trackByMenuItem = (_: number, item: MenuItem) => item.name;
  trackByMenuGroup = (_: number, group: MenuGroup) => group.label;
}