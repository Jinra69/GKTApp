import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  megaphoneOutline,
  chevronForwardOutline,
  gridOutline,
  arrowBackOutline
} from 'ionicons/icons';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

// ── Tipe data notifikasi dari DB ─────────
interface MobileNotif {
  noun_id: number;
  noun_notif: string;   // teks notifikasi dari system.annoucment.mobile
}

// ── Tipe data announcement ────────────────
interface Announcement {
  noun_id: number;
  noun_title: string;
  noun_desc?: string;
}

interface AnnouncementFull {
  noun_id: number;
  noun_title: string;
  noun_desc: string;
  trans_remark: string;
  month: string;
  file_image: string | null;
}

interface AnnouncementGroup {
  month: string;
  items: AnnouncementFull[];
}

// Satu dokumen pengumuman yang di-group, bisa punya beberapa poster
interface PengumumanDoc {
  noun_id: number;
  noun_title: string;
  noun_desc: string;
  trans_remark: string;
  month: string;
  posters: string[];          // array URL gambar
  currentPosterIndex: number; // index slide yang aktif
  autoSlideTimer?: any;
}

interface PengumumanMonthGroup {
  month: string;
  docs: PengumumanDoc[];
}

interface PosterItem {
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonContent, IonIcon],
})
export class HomePage implements OnInit, OnDestroy {

  userName: string  = 'Saudara';
  userCcId: number | null = null;

  private apiUrl = 'https://project.graylite.com/sinode/api.php';

  // ── Announcements dari DB ─────────────────
  announcements: Announcement[] = [];
  announcementsLoading = true;

  // Ticker — tampil per dokumen bergantian
  announcementText = '';
  tickerDuration = '25s';
  currentAnnouncementIndex = 0;
  tickerVisible = true;
  private announcementCycleTimer: any = null;

  // Popup pengumuman
  showPopup = false;
  popupTitle = '';
  popupBody = '';
  get formattedPopupBody(): string {
    return this.popupBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // ── Poster slider dari database ───────────
  posters: PosterItem[] = [];
  postersLoading = false;

  currentPosterIndex = 0;
  private autoSlideTimer: any;
  private touchStartX = 0;
  private touchDeltaX = 0;
  private isDragging = false;

  showPosterPopup = false;
  selectedPoster: any = null;

  // ── Halaman Pengumuman ────────────────────
  showPengumumanPage = false;
  pengumumanGroups: AnnouncementGroup[] = [];   // kept for legacy compatibility
  pengumumanMonthGroups: PengumumanMonthGroup[] = [];
  pengumumanLoading = false;
  selectedPengumuman: PengumumanDoc | null = null;
  showPengumumanDetail = false;
  pengumumanDetailPosterIndex = 0;
  pengumumanDetailPosterVisible = false;
  pengumumanDetailAutoSlide: any = null;

  // ── Menu ──────────────────────────────────
  showMenuPopup = false;
  selectedMenu: any = null;
  showAllMenus = false;
  showProfilePopup = false;

  // ── Church Selector (wajib jika cc_id = 0) ──
  showChurchPopup = false;
  showChurchConfirm = false;
  churches: { cc_id: number; cc_name: string }[] = [];
  churchesLoading = false;
  selectedChurchId: number | null = null;
  selectedChurchName = '';
  churchSaving = false;
  churchSaveError = '';
  churchSearchQuery = '';
  _filteredChurches: { cc_id: number; cc_name: string }[] = [];
  get filteredChurches() {
    return this._filteredChurches;
  }
  onChurchSearchChange() {
    const q = this.churchSearchQuery.trim().toLowerCase();
    this._filteredChurches = q
      ? this.churches.filter(c => c.cc_name.toLowerCase().includes(q))
      : this.churches;
    this.mark();
  }

  // ── Poster zoom popup (di halaman pengumuman) ──
  showPosterZoom = false;
  posterZoomUrl = '';
  posterZoomScale = 1;
  posterZoomMinScale = 1;
  posterZoomMaxScale = 4;
  private pzLastTouchDist = 0;
  private pzStartScale = 1;
  private pzTouchTimer: any = null;
  private pzLastTap = 0;

  // TrackBy helpers
  trackByMonth = (_: number, g: PengumumanMonthGroup) => g.month;
  trackByNounId = (_: number, d: PengumumanDoc) => d.noun_id;
  trackByIndex = (i: number) => i;
  trackByMenuGroup = (_: number, g: any) => g.label;
  trackByMenuItem = (_: number, m: any) => m.name;

  private mark() { this.cdr.markForCheck(); }

  // ✅ FIX: Deklarasi menuItems yang sebelumnya hilang
  menuItems = [
    { icon: '📣', name: 'Pengumuman', desc: 'Info & berita', bg: '#FFF0EB', detail: '', action: 'pengumuman' },
    { icon: '📖', name: 'Firman', desc: 'Renungan harian', bg: '#FFF7EB', detail: 'Baca renungan harian, khotbah mingguan, dan materi PA yang disiapkan hamba Tuhan GKT.', action: '' },
    { icon: '🎵', name: 'Pujian', desc: 'Lagu & lirik', bg: '#EBFFF4', detail: 'Koleksi lagu pujian lengkap dengan lirik, not balok, dan panduan tim musik.', action: '' },
    { icon: '💰', name: 'Persembahan', desc: 'Online offering', bg: '#FFEBF4', detail: 'Berikan persembahan dan perpuluhan secara online dengan mudah dan aman.', action: '' },
    { icon: '📅', name: 'Kalender', desc: 'Agenda gereja', bg: '#F4EBFF', detail: 'Lihat agenda dan kalender kegiatan gereja sepanjang tahun.', action: '' },
  ];

  menuGroups = [
    {
      label: 'Ibadah & Rohani',
      items: [
        { icon: '🙏', name: 'Ibadah', bg: '#EBF4FF', detail: 'Jadwal & streaming ibadah mingguan.' },
        { icon: '📖', name: 'Firman', bg: '#FFF7EB', detail: 'Renungan harian dan khotbah.' },
        { icon: '🎵', name: 'Pujian', bg: '#EBFFF4', detail: 'Lagu pujian dan lirik.' },
        { icon: '🕯️', name: 'Doa', bg: '#F4EBFF', detail: 'Jadwal doa bersama dan topik doa.' },
        { icon: '✝️', name: 'Sakramen', bg: '#FFEBEB', detail: 'Info Baptis, Sidi, dan Perjamuan.' },
        { icon: '📿', name: 'Katekisasi', bg: '#EBFBFF', detail: 'Materi dan jadwal kelas katekisasi.' },
        { icon: '🎙️', name: 'Khotbah', bg: '#FFFBEB', detail: 'Arsip rekaman khotbah mingguan.' },
        { icon: '📻', name: 'Live Stream', bg: '#EBFFFC', detail: 'Tonton ibadah secara langsung.' },
        { icon: '🗓️', name: 'Liturgi', bg: '#F0EBFF', detail: 'Tata ibadah dan liturgi minggu ini.' },
        { icon: '🌿', name: 'PA Online', bg: '#EBFFF0', detail: 'Pendalaman Alkitab online.' },
      ]
    },
    {
      label: 'Jemaat & Pelayanan',
      items: [
        { icon: '👥', name: 'Komsel', bg: '#F4EBFF', detail: 'Kelompok sel di wilayah Anda.' },
        { icon: '💰', name: 'Persembahan', bg: '#FFEBEB', detail: 'Persembahan dan perpuluhan online.' },
        { icon: '📞', name: 'Kontak', bg: '#FFFBEB', detail: 'Hubungi majelis dan pendeta.' },
        { icon: '📰', name: 'Warta', bg: '#EBFFFC', detail: 'Warta jemaat mingguan.' },
        { icon: '🤝', name: 'Diakonia', bg: '#EBF4FF', detail: 'Program sosial dan pelayanan kasih.' },
        { icon: '👶', name: 'Sekolah Minggu', bg: '#FFF7EB', detail: 'Kegiatan anak-anak Sekolah Minggu.' },
        { icon: '🧑‍🤝‍🧑', name: 'Pemuda', bg: '#EBFFF4', detail: 'Persekutuan dan kegiatan pemuda.' },
        { icon: '👩', name: 'Wanita', bg: '#FFEBF4', detail: 'Persekutuan wanita GKT.' },
        { icon: '👨', name: 'Pria', bg: '#EBEFFF', detail: 'Persekutuan pria dewasa GKT.' },
        { icon: '👴', name: 'Lansia', bg: '#FFF9EB', detail: 'Kegiatan dan pelayanan lansia.' },
      ]
    },
    {
      label: 'Info & Administrasi',
      items: [
        { icon: '📅', name: 'Kalender', bg: '#EBFBFF', detail: 'Agenda gereja sepanjang tahun.' },
        { icon: '🗺️', name: 'Lokasi', bg: '#EBFFFC', detail: 'Alamat dan peta lokasi gereja.' },
        { icon: '📋', name: 'Formulir', bg: '#FFF7EB', detail: 'Download formulir pelayanan.' },
        { icon: '📊', name: 'Laporan', bg: '#F4EBFF', detail: 'Laporan keuangan dan kegiatan.' },
        { icon: '📷', name: 'Galeri', bg: '#EBFFF4', detail: 'Foto dan dokumentasi kegiatan.' },
        { icon: '📣', name: 'Pengumuman', bg: '#FFEBEB', detail: 'Semua pengumuman jemaat.' },
        { icon: '🎓', name: 'Seminar', bg: '#EBF4FF', detail: 'Pendaftaran dan info seminar.' },
        { icon: '💌', name: 'Surat', bg: '#FFFBEB', detail: 'Surat dan notifikasi resmi gereja.' },
        { icon: '⚙️', name: 'Pengaturan', bg: '#F0EBFF', detail: 'Atur preferensi akun Anda.' },
        { icon: '❓', name: 'Bantuan', bg: '#EBEFFF', detail: 'FAQ dan pusat bantuan.' },
      ]
    }
  ];

  // ── Verse ─────────────────────────────────
  verseText = '';
  verseRef = '';
  verseLoading = true;
  showVersePopup = false;
  verseCopied = false;

  private readonly versePool = [
    { book: 'Yohanes', chapter: 3, verse: 16 },
    { book: 'Mazmur', chapter: 23, verse: 1 },
    { book: 'Yeremia', chapter: 29, verse: 11 },
    { book: 'Filipi', chapter: 4, verse: 13 },
    { book: 'Roma', chapter: 8, verse: 28 },
    { book: 'Amsal', chapter: 3, verse: 5 },
    { book: 'Yesaya', chapter: 40, verse: 31 },
    { book: 'Matius', chapter: 11, verse: 28 },
    { book: 'Mazmur', chapter: 46, verse: 1 },
    { book: 'Galatia', chapter: 2, verse: 20 },
    { book: 'Efesus', chapter: 2, verse: 8 },
    { book: '1 Korintus', chapter: 13, verse: 4 },
    { book: 'Amsal', chapter: 22, verse: 6 },
    { book: 'Yosua', chapter: 1, verse: 9 },
    { book: 'Mazmur', chapter: 119, verse: 105 },
    { book: 'Roma', chapter: 12, verse: 2 },
    { book: '2 Timotius', chapter: 1, verse: 7 },
    { book: 'Matius', chapter: 5, verse: 9 },
    { book: 'Yohanes', chapter: 14, verse: 6 },
    { book: 'Filipi', chapter: 4, verse: 7 },
  ];

  private backButtonListener: any = null;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    addIcons({ megaphoneOutline, chevronForwardOutline, gridOutline, arrowBackOutline });
  }

  ngOnInit() {
    const stored = localStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      this.userName = user.user_name || 'Saudara';
      this.userCcId = user.cc_id ?? null;
    } else {
      this.userCcId = null;
    }

    this.disableAndroidBackButton();
    this.sendWelcomeNotification();

    if (!this.userCcId || this.userCcId === 0) {
      this.showChurchPopup = true;
      this.loadChurches();
    } else {
      this.loadAnnouncements();
      this.loadPosters();
    }

    this.loadDailyVerse();
  }

  // ══════════════════════════════════════════
  // ANNOUNCEMENTS & POSTERS (dari DATABASE)
  // ══════════════════════════════════════════

  private async loadAnnouncements() {
    if (!this.userCcId || this.userCcId === 0) {
      this.announcementsLoading = false;
      return;
    }

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_announcements_ticker',
          cc_id: this.userCcId
        })
      });

      const data = await res.json();

      this.ngZone.run(() => {
        if (data.success && data.data && Array.isArray(data.data)) {
          this.announcements = data.data;
          this.currentAnnouncementIndex = 0;

          // Tampilkan dokumen pertama
          this.announcementText = this.announcements[0].noun_title;
          this.calculateTickerDuration();
          this.tickerVisible = true;

          // Mulai cycle pergantian antar dokumen
          this.startAnnouncementCycle();
        } else {
          this.announcementText = 'Tidak ada pengumuman.';
        }
        this.announcementsLoading = false;
        this.mark();
      });
    } catch (err) {
      this.ngZone.run(() => {
        this.announcementsLoading = false;
        this.announcementText = 'Gagal memuat pengumuman.';
        this.mark();
      });
    }
  }

  private async loadPosters() {
    if (!this.userCcId || this.userCcId === 0) {
      this.postersLoading = false;
      return;
    }

    try {
      this.postersLoading = true;

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_announcements_posters',
          cc_id: this.userCcId
        })
      });

      const data = await res.json();

      this.ngZone.run(() => {
        if (data.success && data.data && Array.isArray(data.data)) {
          this.posters = data.data.map((p: any) => ({
            src: p.file_image || '',
            alt: 'Poster',
            caption: ''
          }));

          if (this.posters.length > 0) {
            setTimeout(() => this.initSlider(), 100);
          }
        } else {
          this.posters = [];
        }
        this.postersLoading = false;
        this.mark();
      });
    } catch (err) {
      this.ngZone.run(() => {
        this.postersLoading = false;
        this.posters = [];
        this.mark();
      });
    }
  }

  // ══════════════════════════════════════════
  // TICKER LOGIC — CYCLE PER DOKUMEN
  // ══════════════════════════════════════════

  private calculateTickerDuration() {
    const textLength = this.announcementText.length;
    const duration = Math.max(10, Math.ceil(textLength * 0.15));
    this.tickerDuration = `${duration}s`;
  }

  private resetTickerAnimation() {
    setTimeout(() => {
      const tickerEl = document.querySelector('.ticker-inner') as HTMLElement;
      if (tickerEl) {
        tickerEl.style.animation = 'none';
        void tickerEl.offsetWidth; // force reflow
        tickerEl.style.animation = '';
      }
    }, 50);
  }

  private startAnnouncementCycle() {
    if (this.announcementCycleTimer) clearTimeout(this.announcementCycleTimer);

    const current = this.announcements[this.currentAnnouncementIndex];
    const textLength = current.noun_title.length;
    const displayMs = Math.max(10, Math.ceil(textLength * 0.15)) * 1000;

    this.announcementCycleTimer = setTimeout(() => {
      // Kalau hanya 1 dokumen, langsung loop ulang animasi tanpa fade
      if (this.announcements.length <= 1) {
        this.ngZone.run(() => {
          this.resetTickerAnimation();
          this.startAnnouncementCycle();
        });
        return;
      }

      // Lebih dari 1 dokumen → fade out dulu
      this.ngZone.run(() => {
        this.tickerVisible = false;
        this.mark();
      });

      // Jeda 1 detik lalu tampilkan dokumen berikutnya
      setTimeout(() => {
        this.ngZone.run(() => {
          this.currentAnnouncementIndex =
            (this.currentAnnouncementIndex + 1) % this.announcements.length;

          const next = this.announcements[this.currentAnnouncementIndex];
          this.announcementText = next.noun_title;
          this.calculateTickerDuration();
          this.tickerVisible = true;
          this.mark();

          this.resetTickerAnimation();
          this.startAnnouncementCycle();
        });
      }, 1000);
    }, displayMs);
  }

  private stopAnnouncementCycle() {
    if (this.announcementCycleTimer) {
      clearTimeout(this.announcementCycleTimer);
      this.announcementCycleTimer = null;
    }
  }

  // Klik ticker → tampilkan noun_desc dokumen yang sedang aktif
  openAnnouncement() {
    const current = this.announcements[this.currentAnnouncementIndex];
    if (current) {
      this.popupTitle = current.noun_title;
      this.popupBody  = current.noun_desc ?? 'Tidak ada detail pengumuman.';
    }
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }

  // ══════════════════════════════════════════
  // POSTER SLIDER LOGIC
  // ══════════════════════════════════════════

  private initSlider() {
    this.startAutoSlide();
  }

  private startAutoSlide() {
    this.stopAutoSlide();
    if (this.posters.length <= 1) return;
    this.autoSlideTimer = setInterval(() => {
      if (!this.isDragging) {
        this.currentPosterIndex = (this.currentPosterIndex + 1) % this.posters.length;
        this.mark();
      }
    }, 5000);
  }

  private stopAutoSlide() {
    if (this.autoSlideTimer) {
      clearInterval(this.autoSlideTimer);
      this.autoSlideTimer = null;
    }
  }

  onPosterTouchStart(e: TouchEvent) {
    this.isDragging = true;
    this.touchStartX = e.touches[0].clientX;
    this.touchDeltaX = 0;
    this.stopAutoSlide();
  }

  onPosterTouchMove(e: TouchEvent) {
    if (!this.isDragging) return;
    this.touchDeltaX = e.touches[0].clientX - this.touchStartX;
  }

  onPosterTouchEnd() {
    this.isDragging = false;
    const threshold = 50;
    if (this.touchDeltaX > threshold) {
      this.currentPosterIndex = (this.currentPosterIndex - 1 + this.posters.length) % this.posters.length;
    } else if (this.touchDeltaX < -threshold) {
      this.currentPosterIndex = (this.currentPosterIndex + 1) % this.posters.length;
    }
    this.mark();
    this.startAutoSlide();
  }

  goToPoster(index: number) {
    this.currentPosterIndex = index;
    this.mark();
    this.startAutoSlide();
  }

  openPosterPopup(index: number) {
    this.selectedPoster = this.posters[index];
    this.showPosterPopup = true;
  }

  closePosterPopup() {
    this.showPosterPopup = false;
    this.selectedPoster = null;
  }

  // ── Poster Zoom (dipakai di home slider & halaman pengumuman) ──
  openPosterZoom(url: string, event?: Event) {
    if (event) event.stopPropagation();
    this.posterZoomUrl = url;
    this.posterZoomScale = 1;
    this.showPosterZoom = true;
    this.mark();
  }

  closePosterZoom() {
    this.showPosterZoom = false;
    this.posterZoomUrl = '';
    this.posterZoomScale = 1;
    if (this.pzTouchTimer) { clearTimeout(this.pzTouchTimer); this.pzTouchTimer = null; }
  }

  pzZoomIn()  { this.posterZoomScale = Math.min(this.posterZoomMaxScale, +(this.posterZoomScale + 0.5).toFixed(1)); this.mark(); }
  pzZoomOut() { this.posterZoomScale = Math.max(this.posterZoomMinScale, +(this.posterZoomScale - 0.5).toFixed(1)); this.mark(); }
  pzReset()   { this.posterZoomScale = 1; this.mark(); }

  // Pinch-to-zoom
  onPzTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      this.pzLastTouchDist = this.getTouchDist(e);
      this.pzStartScale = this.posterZoomScale;
    }
    // Double-tap detect
    const now = Date.now();
    if (now - this.pzLastTap < 300) {
      this.posterZoomScale = this.posterZoomScale > 1 ? 1 : 2;
      this.mark();
    }
    this.pzLastTap = now;
  }

  onPzTouchMove(e: TouchEvent) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dist = this.getTouchDist(e);
    const ratio = dist / this.pzLastTouchDist;
    this.posterZoomScale = Math.min(
      this.posterZoomMaxScale,
      Math.max(this.posterZoomMinScale, +(this.pzStartScale * ratio).toFixed(2))
    );
    this.mark();
  }

  private getTouchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ══════════════════════════════════════════
  // CHURCH SELECTOR
  // ══════════════════════════════════════════

  private async loadChurches() {
    this.churchesLoading = true;
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_churches' })
      });
      const data = await res.json();

      this.ngZone.run(() => {
        if (data.success && Array.isArray(data.data)) {
          this.churches = data.data;
          this._filteredChurches = this.churches; // init cache
        }
        this.churchesLoading = false;
        this.mark();
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.churchesLoading = false;
        this.mark();
      });
    }
  }

  selectChurch(ccId: number) {
    this.selectedChurchId = ccId;
    this.selectedChurchName = this.churches.find(c => c.cc_id === ccId)?.cc_name ?? '';
    this.churchSaveError = '';
  }

  askConfirmChurch() {
    if (!this.selectedChurchId) {
      this.churchSaveError = 'Silakan pilih gereja terlebih dahulu.';
      return;
    }
    this.showChurchConfirm = true;
  }

  cancelConfirmChurch() {
    this.showChurchConfirm = false;
  }

  async confirmChurch() {
    if (!this.selectedChurchId) {
      this.churchSaveError = 'Silakan pilih gereja terlebih dahulu.';
      return;
    }
    this.churchSaving = true;
    this.churchSaveError = '';
    try {
      const stored = localStorage.getItem('user');
      if (!stored) throw new Error('Session tidak ditemukan.');
      const user = JSON.parse(stored);
      const mobId = user.mob_id;

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_cc_id',
          mob_id: mobId,
          cc_id: this.selectedChurchId
        })
      });
      const data = await res.json();

      this.ngZone.run(() => {
        if (data.success) {
          user.cc_id = this.selectedChurchId;
          this.userCcId = this.selectedChurchId;
          localStorage.setItem('user', JSON.stringify(user));

          this.showChurchPopup = false;
          this.showChurchConfirm = false;
          this.churchSaving = false;

          this.announcementsLoading = true;
          this.postersLoading = true;
          this.loadAnnouncements();
          this.loadPosters();
          this.mark();
        } else {
          this.churchSaveError = data.message || 'Gagal menyimpan. Coba lagi.';
          this.churchSaving = false;
          this.showChurchConfirm = false;
          this.mark();
        }
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.churchSaveError = 'Terjadi kesalahan. Periksa koneksi Anda.';
        this.churchSaving = false;
        this.showChurchConfirm = false;
        this.mark();
      });
    }
  }

  openMenu(item: any) {
    if (item.action === 'pengumuman') {
      this.openPengumumanPage();
      return;
    }
    this.selectedMenu = item;
    this.showMenuPopup = true;
  }
  closeMenuPopup() { this.showMenuPopup = false; this.selectedMenu = null; }
  openAllMenus() { this.showAllMenus = true; }
  closeAllMenus() { this.showAllMenus = false; }
  openProfilePopup() { this.showProfilePopup = true; }
  closeProfilePopup() { this.showProfilePopup = false; }
  changePassword() { this.closeProfilePopup(); }

  // ── Pengumuman Page ───────────────────────
  openPengumumanPage() {
    this.showPengumumanPage = true;
    if (this.pengumumanMonthGroups.length === 0) {
      this.loadAllAnnouncements();
    } else {
      // Data sudah ada, start slide sekarang
      for (const mg of this.pengumumanMonthGroups) {
        for (const doc of mg.docs) {
          this.startDocSlide(doc);
        }
      }
    }
  }

  closePengumumanPage() {
    this.showPengumumanPage = false;
    // Hentikan semua auto-slide card saat page ditutup
    for (const mg of this.pengumumanMonthGroups) {
      for (const doc of mg.docs) {
        this.stopDocSlide(doc);
      }
    }
  }

  openPengumumanDetail(doc: PengumumanDoc) {
    this.selectedPengumuman = doc;
    this.pengumumanDetailPosterIndex = 0;
    this.pengumumanDetailPosterVisible = false;
    this.showPengumumanDetail = true;
    setTimeout(() => {
      this.pengumumanDetailPosterVisible = true;
      this.mark();
      // Auto-slide di popup detail kalau lebih dari 1 poster
      this.startDetailSlide();
    }, 100);
  }

  closePengumumanDetail() {
    this.showPengumumanDetail = false;
    this.selectedPengumuman = null;
    this.stopDetailSlide();
  }

  private startDetailSlide() {
    this.stopDetailSlide();
    if (!this.selectedPengumuman || this.selectedPengumuman.posters.length <= 1) return;
    this.pengumumanDetailAutoSlide = setInterval(() => {
      if (!this.selectedPengumuman) return;
      this.pengumumanDetailPosterIndex =
        (this.pengumumanDetailPosterIndex + 1) % this.selectedPengumuman.posters.length;
      this.mark();
    }, 3000);
  }

  private stopDetailSlide() {
    if (this.pengumumanDetailAutoSlide) {
      clearInterval(this.pengumumanDetailAutoSlide);
      this.pengumumanDetailAutoSlide = null;
    }
  }

  goToDetailPoster(i: number) {
    this.pengumumanDetailPosterIndex = i;
    this.stopDetailSlide();
    this.startDetailSlide();
    this.mark();
  }

  // Slide card-level per dokumen
  startDocSlide(doc: PengumumanDoc) {
    if (doc.autoSlideTimer) return;
    if (doc.posters.length <= 1) return;
    doc.autoSlideTimer = setInterval(() => {
      doc.currentPosterIndex = (doc.currentPosterIndex + 1) % doc.posters.length;
      this.mark();
    }, 3500);
  }

  stopDocSlide(doc: PengumumanDoc) {
    if (doc.autoSlideTimer) {
      clearInterval(doc.autoSlideTimer);
      doc.autoSlideTimer = undefined;
    }
  }

  goToDocPoster(doc: PengumumanDoc, i: number) {
    doc.currentPosterIndex = i;
    this.stopDocSlide(doc);
    this.startDocSlide(doc);
    this.mark();
  }

  private async loadAllAnnouncements() {
    if (!this.userCcId || this.userCcId === 0) return;
    this.pengumumanLoading = true;
    this.mark();

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_all_announcements', cc_id: this.userCcId })
      });
      const data = await res.json();

      this.ngZone.run(() => {
        if (data.success && Array.isArray(data.data)) {
          // --- Group per noun_id (satu dokumen bisa banyak baris / poster) ---
          const docMap = new Map<number, PengumumanDoc>();
          for (const item of data.data as AnnouncementFull[]) {
            if (!docMap.has(item.noun_id)) {
              docMap.set(item.noun_id, {
                noun_id: item.noun_id,
                noun_title: item.noun_title,
                noun_desc: item.noun_desc,
                trans_remark: item.trans_remark,
                month: item.month || 'Lainnya',
                posters: [],
                currentPosterIndex: 0,
              });
            }
            if (item.file_image) {
              docMap.get(item.noun_id)!.posters.push(item.file_image);
            }
          }

          // --- Group doc per bulan ---
          const monthMap = new Map<string, PengumumanDoc[]>();
          for (const doc of docMap.values()) {
            const key = doc.month;
            if (!monthMap.has(key)) monthMap.set(key, []);
            monthMap.get(key)!.push(doc);
          }
          this.pengumumanMonthGroups = Array.from(monthMap.entries())
            .map(([month, docs]) => ({ month, docs }));

          // Auto-slide dimulai lazy saat card pertama kali ditampilkan (via openPengumumanPage)
          // bukan langsung semua sekaligus — lihat startDocSlide yang dipanggil on-demand
          if (this.showPengumumanPage) {
            for (const mg of this.pengumumanMonthGroups) {
              for (const doc of mg.docs) {
                this.startDocSlide(doc);
              }
            }
          }
        }
        this.pengumumanLoading = false;
        this.mark();
      });
    } catch {
      this.ngZone.run(() => {
        this.pengumumanLoading = false;
        this.mark();
      });
    }
  }

  logout() {
    this.closeProfilePopup();
    localStorage.removeItem('user');
    localStorage.removeItem('gkt_daily_verse');
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // ══════════════════════════════════════════
  // VERSE
  // ══════════════════════════════════════════
  openVersePopup() { this.showVersePopup = true; }
  closeVersePopup() { this.showVersePopup = false; this.verseCopied = false; }

  copyVerse() {
    const text = `"${this.verseText}" — ${this.verseRef}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.verseCopied = true;
        setTimeout(() => this.verseCopied = false, 2500);
      });
    }
  }

  private async loadDailyVerse() {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'gkt_daily_verse';
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.date === today && parsed.text && parsed.ref) {
          this.verseText = parsed.text;
          this.verseRef = parsed.ref;
          this.verseLoading = false;
          return;
        }
      } catch {
        // Cache corrupt → hapus
      }
      localStorage.removeItem(cacheKey);
    }

    const idx = this.getDayOfYear() % this.versePool.length;
    const pick = this.versePool[idx];

    try {
      const url = `https://alkitab.mobi/api/?passage=${encodeURIComponent(pick.book + ' ' + pick.chapter + ':' + pick.verse)}&version=tb`;
      const data = await (await fetch(url)).json();
      const text = data?.[0]?.verses?.[0]?.text?.trim() ?? '';
      const ref = `${pick.book} ${pick.chapter}:${pick.verse}`;
      if (text) {
        this.verseText = text;
        this.verseRef = ref;
        localStorage.setItem(cacheKey, JSON.stringify({ date: today, text, ref }));
      } else {
        this.setFallbackVerse();
      }
    } catch {
      this.setFallbackVerse();
    } finally {
      this.verseLoading = false;
    }
  }

  private setFallbackVerse() {
    this.verseText = 'Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.';
    this.verseRef = 'Yohanes 3:16';
  }

  private getDayOfYear(): number {
    const now = new Date();
    return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  }

  // ══════════════════════════════════════════
  // ANDROID BACK BUTTON
  // ══════════════════════════════════════════
  private disableAndroidBackButton() {
    try {
      this.backButtonListener = App.addListener('backButton', () => {
        if (this.showChurchPopup) { return; }
        if (this.showPosterZoom) { this.closePosterZoom(); return; }
        if (this.showPengumumanDetail) { this.closePengumumanDetail(); return; }
        if (this.showPengumumanPage) { this.closePengumumanPage(); return; }
        if (this.showProfilePopup) { this.closeProfilePopup(); return; }
        if (this.showVersePopup) { this.closeVersePopup(); return; }
        if (this.showPosterPopup) { this.closePosterPopup(); return; }
        if (this.showMenuPopup) { this.closeMenuPopup(); return; }
        if (this.showPopup) { this.closePopup(); return; }
        if (this.showAllMenus) { this.closeAllMenus(); return; }
      });
    } catch (err) {
      console.warn('App backButton listener tidak tersedia:', err);
    }
  }

  private async sendWelcomeNotification() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      if (display !== 'granted') return;

      // Ambil noun_notif dari DB — satu baris = satu notifikasi
      let notifs: MobileNotif[] = [];
      try {
        const res = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_mobile_notifications',
            cc_id: this.userCcId
          })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          notifs = data.data;
        }
      } catch {
        // API gagal → fallback ke welcome default
      }

      // Kalau tidak ada data dari DB, pakai pesan default
      if (notifs.length === 0) {
        notifs = [{
          noun_id: 0,
          noun_notif: `Selamat datang, ${this.userName}! 🙏 Tuhan memberkati hari ini.`
        }];
      }

      // Schedule satu notifikasi per item, jeda 1.5 detik antar notif
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
    } catch (err) {
      console.warn('LocalNotifications tidak tersedia:', err);
    }
  }

  ngOnDestroy() {
    this.stopAutoSlide();
    this.stopAnnouncementCycle();
    this.stopDetailSlide();
    if (this.pzTouchTimer) clearTimeout(this.pzTouchTimer);
    for (const mg of this.pengumumanMonthGroups) {
      for (const doc of mg.docs) {
        this.stopDocSlide(doc);
      }
    }
    if (this.backButtonListener) this.backButtonListener.remove();
  }
}