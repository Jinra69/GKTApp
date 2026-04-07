import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
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

// ── Tipe data announcement ────────────────
interface Announcement {
  noun_desc:  string;
  file_image: string | null;   // base64 data URL atau null
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon],
})
export class HomePage implements OnInit, OnDestroy {

  userName: string  = 'Saudara';
  userCcId: number | null = null;

  private apiUrl = 'https://project.graylite.com/sinode/api.php';

  // ── Announcements dari DB ─────────────────
  announcements:        Announcement[] = [];
  announcementsLoading  = true;

  // Ticker text — digabung dari semua noun_desc
  announcementText = '';
  tickerDuration   = '25s'; // dinamis sesuai panjang teks

  // Popup pengumuman — klik ticker buka list semua
  showPopup    = false;
  popupTitle   = '';
  popupBody    = '';
  get formattedPopupBody(): string {
    return this.popupBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // ── Poster slider — file lokal ───────────
  posters: { src: string; alt: string; caption: string }[] = [
    { src: 'assets/poster1.jpg', alt: 'Poster 1', caption: '' },
    { src: 'assets/poster2.jpg', alt: 'Poster 2', caption: '' },
    { src: 'assets/poster3.jpg', alt: 'Poster 3', caption: '' },
  ];
  postersLoading    = false;

  currentPosterIndex = 0;
  posterOffset       = 0;
  private sliderWidth    = 0;
  private autoSlideTimer: any;
  private touchStartX   = 0;
  private touchDeltaX   = 0;
  private isDragging    = false;

  showPosterPopup = false;
  selectedPoster: any = null;

  // ── Menu ──────────────────────────────────
  showMenuPopup    = false;
  selectedMenu: any = null;
  showAllMenus     = false;
  showProfilePopup = false;

  // ── Church Selector (wajib jika cc_id = 0) ──
  showChurchPopup   = false;
  showChurchConfirm = false;
  churches: { cc_id: number; cc_name: string }[] = [];
  churchesLoading   = false;
  selectedChurchId: number | null = null;
  selectedChurchName = '';
  churchSaving      = false;
  churchSaveError   = '';
  churchSearchQuery = '';
  get filteredChurches() {
    const q = this.churchSearchQuery.trim().toLowerCase();
    if (!q) return this.churches;
    return this.churches.filter(c => c.cc_name.toLowerCase().includes(q));
  }

  menuItems = [
    { icon: '🙏', name: 'Ibadah',       desc: 'Jadwal & streaming',   bg: '#EBF4FF', detail: 'Lihat jadwal ibadah mingguan, ibadah kategorial, dan akses live streaming kebaktian.' },
    { icon: '📖', name: 'Firman',       desc: 'Renungan harian',      bg: '#FFF7EB', detail: 'Baca renungan harian, khotbah mingguan, dan materi PA yang disiapkan hamba Tuhan GKT.' },
    { icon: '🎵', name: 'Pujian',       desc: 'Lagu & lirik',         bg: '#EBFFF4', detail: 'Koleksi lagu pujian lengkap dengan lirik, not balok, dan panduan tim musik.' },
    { icon: '💰', name: 'Persembahan',  desc: 'Online offering',      bg: '#FFF0EB', detail: 'Berikan persembahan dan perpuluhan secara online dengan mudah dan aman.' },
    { icon: '📅', name: 'Kalender',     desc: 'Agenda gereja',        bg: '#F4EBFF', detail: 'Lihat agenda dan kalender kegiatan gereja sepanjang tahun.' },
  ];

  menuGroups = [
    {
      label: 'Ibadah & Rohani',
      items: [
        { icon: '🙏', name: 'Ibadah',       bg: '#EBF4FF', detail: 'Jadwal & streaming ibadah mingguan.' },
        { icon: '📖', name: 'Firman',        bg: '#FFF7EB', detail: 'Renungan harian dan khotbah.' },
        { icon: '🎵', name: 'Pujian',        bg: '#EBFFF4', detail: 'Lagu pujian dan lirik.' },
        { icon: '🕯️', name: 'Doa',           bg: '#F4EBFF', detail: 'Jadwal doa bersama dan topik doa.' },
        { icon: '✝️', name: 'Sakramen',      bg: '#FFEBEB', detail: 'Info Baptis, Sidi, dan Perjamuan.' },
        { icon: '📿', name: 'Katekisasi',    bg: '#EBFBFF', detail: 'Materi dan jadwal kelas katekisasi.' },
        { icon: '🎙️', name: 'Khotbah',      bg: '#FFFBEB', detail: 'Arsip rekaman khotbah mingguan.' },
        { icon: '📻', name: 'Live Stream',   bg: '#EBFFFC', detail: 'Tonton ibadah secara langsung.' },
        { icon: '🗓️', name: 'Liturgi',      bg: '#F0EBFF', detail: 'Tata ibadah dan liturgi minggu ini.' },
        { icon: '🌿', name: 'PA Online',     bg: '#EBFFF0', detail: 'Pendalaman Alkitab online.' },
      ]
    },
    {
      label: 'Jemaat & Pelayanan',
      items: [
        { icon: '👥', name: 'Komsel',        bg: '#F4EBFF', detail: 'Kelompok sel di wilayah Anda.' },
        { icon: '💰', name: 'Persembahan',   bg: '#FFEBEB', detail: 'Persembahan dan perpuluhan online.' },
        { icon: '📞', name: 'Kontak',        bg: '#FFFBEB', detail: 'Hubungi majelis dan pendeta.' },
        { icon: '📰', name: 'Warta',         bg: '#EBFFFC', detail: 'Warta jemaat mingguan.' },
        { icon: '🤝', name: 'Diakonia',      bg: '#EBF4FF', detail: 'Program sosial dan pelayanan kasih.' },
        { icon: '👶', name: 'Sekolah Minggu',bg: '#FFF7EB', detail: 'Kegiatan anak-anak Sekolah Minggu.' },
        { icon: '🧑‍🤝‍🧑', name: 'Pemuda',  bg: '#EBFFF4', detail: 'Persekutuan dan kegiatan pemuda.' },
        { icon: '👩', name: 'Wanita',        bg: '#FFEBF4', detail: 'Persekutuan wanita GKT.' },
        { icon: '👨', name: 'Pria',          bg: '#EBEFFF', detail: 'Persekutuan pria dewasa GKT.' },
        { icon: '👴', name: 'Lansia',        bg: '#FFF9EB', detail: 'Kegiatan dan pelayanan lansia.' },
      ]
    },
    {
      label: 'Info & Administrasi',
      items: [
        { icon: '📅', name: 'Kalender',      bg: '#EBFBFF', detail: 'Agenda gereja sepanjang tahun.' },
        { icon: '🗺️', name: 'Lokasi',        bg: '#EBFFFC', detail: 'Alamat dan peta lokasi gereja.' },
        { icon: '📋', name: 'Formulir',      bg: '#FFF7EB', detail: 'Download formulir pelayanan.' },
        { icon: '📊', name: 'Laporan',       bg: '#F4EBFF', detail: 'Laporan keuangan dan kegiatan.' },
        { icon: '📷', name: 'Galeri',        bg: '#EBFFF4', detail: 'Foto dan dokumentasi kegiatan.' },
        { icon: '📣', name: 'Pengumuman',    bg: '#FFEBEB', detail: 'Semua pengumuman jemaat.' },
        { icon: '🎓', name: 'Seminar',       bg: '#EBF4FF', detail: 'Pendaftaran dan info seminar.' },
        { icon: '💌', name: 'Surat',         bg: '#FFFBEB', detail: 'Surat dan notifikasi resmi gereja.' },
        { icon: '⚙️', name: 'Pengaturan',   bg: '#F0EBFF', detail: 'Atur preferensi akun Anda.' },
        { icon: '❓', name: 'Bantuan',       bg: '#EBEFFF', detail: 'FAQ dan pusat bantuan.' },
      ]
    }
  ];

  // ── Verse ─────────────────────────────────
  verseText    = '';
  verseRef     = '';
  verseLoading = true;
  showVersePopup  = false;
  verseCopied     = false;

  private readonly versePool = [
    { book: 'Yohanes',      chapter: 3,  verse: 16  },
    { book: 'Mazmur',       chapter: 23, verse: 1   },
    { book: 'Yeremia',      chapter: 29, verse: 11  },
    { book: 'Filipi',       chapter: 4,  verse: 13  },
    { book: 'Roma',         chapter: 8,  verse: 28  },
    { book: 'Amsal',        chapter: 3,  verse: 5   },
    { book: 'Yesaya',       chapter: 40, verse: 31  },
    { book: 'Matius',       chapter: 11, verse: 28  },
    { book: 'Mazmur',       chapter: 46, verse: 1   },
    { book: 'Galatia',      chapter: 2,  verse: 20  },
    { book: 'Efesus',       chapter: 2,  verse: 8   },
    { book: '1 Korintus',   chapter: 13, verse: 4   },
    { book: 'Amsal',        chapter: 22, verse: 6   },
    { book: 'Yosua',        chapter: 1,  verse: 9   },
    { book: 'Mazmur',       chapter: 119,verse: 105 },
    { book: 'Roma',         chapter: 12, verse: 2   },
    { book: '2 Timotius',   chapter: 1,  verse: 7   },
    { book: 'Matius',       chapter: 5,  verse: 9   },
    { book: 'Yohanes',      chapter: 14, verse: 6   },
    { book: 'Filipi',       chapter: 4,  verse: 7   },
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
      const user     = JSON.parse(stored);
      this.userName  = user.user_name || 'Saudara';
      this.userCcId  = user.cc_id    ?? null;
    }

    this.disableAndroidBackButton();
    this.sendWelcomeNotification();

    // Jika cc_id belum diset (0 atau null), tampilkan popup pilih gereja
    if (!this.userCcId || this.userCcId === 0) {
      this.openChurchPopup();
    }

    // Bersihkan cache ayat lama yang mungkin corrupt
    const cached = localStorage.getItem('gkt_daily_verse');
    if (cached) {
      try {
        const p = JSON.parse(cached);
        if (!p.text || !p.ref || !p.date) localStorage.removeItem('gkt_daily_verse');
      } catch { localStorage.removeItem('gkt_daily_verse'); }
    }

    this.loadDailyVerse();
    this.loadAnnouncements();   // ← load data dari DB

    // Init slider lokal setelah view siap
    setTimeout(() => {
      const wrap = document.querySelector('.poster-slider-wrap') as HTMLElement;
      if (wrap) this.sliderWidth = wrap.offsetWidth;
      if (this.posters.length > 1) this.startAutoSlide();
    }, 200);
  }

  // ══════════════════════════════════════════
  // LOAD ANNOUNCEMENTS + POSTERS DARI DB
  // ══════════════════════════════════════════
  private async loadAnnouncements() {
    console.log('USER CC_ID:', this.userCcId);

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_announcements', cc_id: this.userCcId ?? 0 })
      });

      const data = await res.json();
      console.log('API RESPONSE:', data);

      this.ngZone.run(() => {

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {

          this.announcements = data.data;

          // TEXT TICKER — durasi proporsional panjang teks (min 20s, ~0.1s per karakter)
          this.announcementText = data.data
            .map((a: any) => '📢 ' + (a.noun_desc || ''))
            .join('     ·     ');
          const charCount = this.announcementText.length;
          const duration  = Math.max(20, Math.round(charCount * 0.18));
          this.tickerDuration = duration + 's';

          // POSTER tidak lagi dari API — pakai file lokal

        } else {
          // Fallback: tetap isi announcements agar popup bisa terbuka
          this.announcements = [{ noun_desc: 'Tidak ada pengumuman baru saat ini.', file_image: null }];
          this.announcementText = '📢 Tidak ada pengumuman saat ini.';
        }

        this.announcementsLoading = false;
        this.cdr.detectChanges();

      });

    } catch (err) {
      console.error('ERROR LOAD ANNOUNCEMENT:', err);

      this.ngZone.run(() => {
        // Fallback: tetap isi announcements agar popup bisa terbuka
        this.announcements = [{ noun_desc: 'Tidak dapat memuat pengumuman. Periksa koneksi Anda.', file_image: null }];
        this.announcementText = '📢 Tidak dapat memuat pengumuman.';
        this.announcementsLoading = false;
        this.cdr.detectChanges();
      });
    }
  }
  
// ── CONVERT GOOGLE DRIVE LINK ─────────────
private convertDriveLink(url: string | null): string {
  if (!url) return '';

  // kalau bukan google drive, langsung pakai
  if (!url.includes('drive.google.com')) return url;

  // format: /file/d/ID/
  let match = url.match(/\/d\/(.*?)\//);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }

  // format: open?id=ID
  match = url.match(/[?&]id=([^&]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }

  return url;
}
  // ── Buka popup pengumuman pertama ─────────
  // (atau bisa dikembangkan jadi list semua)
  openAnnouncement() {
    if (this.announcements.length === 0) return;
    const first      = this.announcements[0];
    this.popupTitle  = '📢 Pengumuman';
    this.popupBody   = first.noun_desc;
    this.showPopup   = true;
  }
  closePopup() { this.showPopup = false; }

  // ══════════════════════════════════════════
  // POSTER SLIDER
  // ══════════════════════════════════════════
  private startAutoSlide() {
    this.stopAutoSlide();
    this.autoSlideTimer = setInterval(() => {
      const next = (this.currentPosterIndex + 1) % this.posters.length;
      this.goToPoster(next);
    }, 3500);
  }

  private stopAutoSlide() {
    if (this.autoSlideTimer) clearInterval(this.autoSlideTimer);
  }

  goToPoster(index: number) {
    this.currentPosterIndex = index;
    const width = this.sliderWidth
      || (document.querySelector('.poster-slider-wrap') as HTMLElement)?.offsetWidth
      || 320;
    this.posterOffset = -index * width;
  }

  onPosterTouchStart(e: TouchEvent) {
    this.stopAutoSlide();
    this.touchStartX = e.touches[0].clientX;
    this.touchDeltaX = 0;
    this.isDragging  = true;
  }

  onPosterTouchMove(e: TouchEvent) {
    if (!this.isDragging) return;
    this.touchDeltaX  = e.touches[0].clientX - this.touchStartX;
    this.posterOffset = (-this.currentPosterIndex * (this.sliderWidth || 320)) + this.touchDeltaX;
  }

  onPosterTouchEnd() {
    this.isDragging = false;
    const threshold = 60;
    if (this.touchDeltaX < -threshold && this.currentPosterIndex < this.posters.length - 1) {
      this.goToPoster(this.currentPosterIndex + 1);
    } else if (this.touchDeltaX > threshold && this.currentPosterIndex > 0) {
      this.goToPoster(this.currentPosterIndex - 1);
    } else {
      this.goToPoster(this.currentPosterIndex);
    }
    if (this.posters.length > 1) this.startAutoSlide();
  }

  openPosterPopup(index: number) {
    if (Math.abs(this.touchDeltaX) > 10) return;
    this.selectedPoster = this.posters[index];
    this.showPosterPopup = true;
  }
  closePosterPopup() { this.showPosterPopup = false; this.selectedPoster = null; }

  // ══════════════════════════════════════════
  // MENU
  // ══════════════════════════════════════════
  // ══════════════════════════════════════════
  // CHURCH SELECTOR
  // ══════════════════════════════════════════
  openChurchPopup() {
    this.showChurchPopup   = true;
    this.churchSaveError   = '';
    this.churchSearchQuery = '';
    this.selectedChurchId  = null;
    if (this.churches.length === 0) this.loadChurches();
  }

  private async loadChurches() {
    this.churchesLoading = true;
    try {
      const res  = await fetch(this.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'get_churches' })
      });
      const data = await res.json();
      this.ngZone.run(() => {
        if (data.success && Array.isArray(data.data)) {
          this.churches = data.data;
        }
        this.churchesLoading = false;
        this.cdr.detectChanges();
      });
    } catch {
      this.ngZone.run(() => {
        this.churchesLoading = false;
        this.churchSaveError = 'Gagal memuat daftar gereja. Periksa koneksi.';
        this.cdr.detectChanges();
      });
    }
  }

  selectChurch(ccId: number) {
    this.selectedChurchId  = ccId;
    this.selectedChurchName = this.churches.find(c => c.cc_id === ccId)?.cc_name ?? '';
    this.churchSaveError   = '';
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
    this.churchSaving    = true;
    this.churchSaveError = '';
    try {
      const stored = localStorage.getItem('user');
      if (!stored) throw new Error('Session tidak ditemukan.');
      const user   = JSON.parse(stored);
      const mobId  = user.mob_id;

      const res  = await fetch(this.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'update_cc_id',
          mob_id: mobId,
          cc_id:  this.selectedChurchId
        })
      });
      const data = await res.json();

      this.ngZone.run(() => {
        if (data.success) {
          // Update localStorage
          user.cc_id         = this.selectedChurchId;
          this.userCcId      = this.selectedChurchId;
          localStorage.setItem('user', JSON.stringify(user));

          this.showChurchPopup    = false;
          this.showChurchConfirm  = false;
          this.churchSaving       = false;

          // Reload announcements dengan cc_id baru
          this.announcementsLoading = true;
          this.loadAnnouncements();
          this.cdr.detectChanges();
        } else {
          this.churchSaveError   = data.message || 'Gagal menyimpan. Coba lagi.';
          this.churchSaving      = false;
          this.showChurchConfirm = false;
          this.cdr.detectChanges();
        }
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.churchSaveError   = 'Terjadi kesalahan. Periksa koneksi Anda.';
        this.churchSaving      = false;
        this.showChurchConfirm = false;
        this.cdr.detectChanges();
      });
    }
  }

  openMenu(item: any)   { this.selectedMenu = item; this.showMenuPopup = true; }
  closeMenuPopup()      { this.showMenuPopup = false; this.selectedMenu = null; }
  openAllMenus()        { this.showAllMenus = true; }
  closeAllMenus()       { this.showAllMenus = false; }
  openProfilePopup()    { this.showProfilePopup = true; }
  closeProfilePopup()   { this.showProfilePopup = false; }
  changePassword()      { this.closeProfilePopup(); }

  logout() {
    this.closeProfilePopup();
    localStorage.removeItem('user');
    localStorage.removeItem('gkt_daily_verse');
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // ══════════════════════════════════════════
  // VERSE
  // ══════════════════════════════════════════
  openVersePopup()  { this.showVersePopup = true; }
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
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = 'gkt_daily_verse';
    const cached   = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Validasi cache: harus ada date, text, dan ref yang tidak kosong
        if (parsed.date === today && parsed.text && parsed.ref) {
          this.verseText    = parsed.text;
          this.verseRef     = parsed.ref;
          this.verseLoading = false;
          return;
        }
      } catch {
        // Cache corrupt → hapus
      }
      localStorage.removeItem(cacheKey);
    }

    const idx  = this.getDayOfYear() % this.versePool.length;
    const pick = this.versePool[idx];

    try {
      const url  = `https://alkitab.mobi/api/?passage=${encodeURIComponent(pick.book + ' ' + pick.chapter + ':' + pick.verse)}&version=tb`;
      const data = await (await fetch(url)).json();
      const text = data?.[0]?.verses?.[0]?.text?.trim() ?? '';
      const ref  = `${pick.book} ${pick.chapter}:${pick.verse}`;
      if (text) {
        this.verseText = text;
        this.verseRef  = ref;
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
    this.verseRef  = 'Yohanes 3:16';
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
        if (this.showChurchPopup)  { return; } // tidak bisa ditutup
        if (this.showProfilePopup) { this.closeProfilePopup(); return; }
        if (this.showVersePopup)   { this.closeVersePopup();   return; }
        if (this.showPosterPopup)  { this.closePosterPopup();  return; }
        if (this.showMenuPopup)    { this.closeMenuPopup();    return; }
        if (this.showPopup)        { this.closePopup();        return; }
        if (this.showAllMenus)     { this.closeAllMenus();     return; }
      });
    } catch (err) {
      console.warn('App backButton listener tidak tersedia:', err);
    }
  }

  private async sendWelcomeNotification() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      if (display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: [{
          id: 1001,
          title: 'GKT Sinode',
          body: `Selamat datang, ${this.userName}! 🙏 Tuhan memberkati hari ini.`,
          schedule: { at: new Date(Date.now() + 1500) },
          smallIcon: 'ic_stat_icon_config_sample',
          actionTypeId: '',
          extra: null,
        }]
      });
    } catch (err) {
      console.warn('LocalNotifications tidak tersedia:', err);
    }
  }

  ngOnDestroy() {
    this.stopAutoSlide();
    if (this.backButtonListener) this.backButtonListener.remove();
  }
}