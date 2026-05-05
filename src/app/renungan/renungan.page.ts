// pages/renungan/renungan.page.ts
import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, calendarOutline, closeOutline,
  bookOutline, arrowForwardOutline, refreshOutline,
  playOutline, pauseOutline, stopOutline,
  volumeHighOutline, volumeMuteOutline, chevronUpOutline
} from 'ionicons/icons';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { ApiService } from '../shared/services/api.service';
import { StorageService } from '../shared/services/storage.service';

export interface Renungan {
  doc_id: number;
  doctype_id: number;
  docflow_seq: number;
  doc_date: string;
  cc_id: number;
  renungan_desc: string;
  renungan_title: string;
  renungan_bg: string | null;
}

@Component({
  selector: 'app-renungan',
  templateUrl: './renungan.page.html',
  styleUrls: ['./renungan.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonButton, IonIcon
  ]
})
export class RenunganPage implements OnInit, OnDestroy {

  renungans: Renungan[] = [];
  filtered: Renungan[]  = [];
  loading               = true;
  skeletons             = Array(6);

  // ── Filter date-range ──────────────────────────
  showDateFilter = false;
  filterFrom     = '';
  filterTo       = '';

  // ── Detail full-screen ─────────────────────────
  selectedItem: Renungan | null = null;

  readonly defaultBg = '#1A2E4A';

  // ── TTS State ─────────────────────────────────
  ttsPlaying     = false;
  ttsPaused      = false;
  ttsProgress    = 0;       // 0–100
  ttsDuration    = 0;       // total chars
  ttsCurrentChar = 0;
  ttsPlayerOpen  = true;
  ttsRate        = 0.50;    // lebih lambat → suara halus, tidak terburu-buru

  // ── Word highlight state ───────────────────────
  ttsActiveWordIdx: number = -1;
  private ttsWordOffsets: number[] = [];
  private ttsWordCount   = 0;

  // ── Internal flags ────────────────────────────
  private ttsInitialized = false;
  private ttsAborted     = false;
  private ttsText        = '';
  private ttsTimer: any  = null;
  private ttsChunkFrom   = 0;

  // ── Voice perempuan yang dipilih ──────────────
  private selectedVoiceUri: string | undefined = undefined;

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    addIcons({
      arrowBackOutline, calendarOutline, closeOutline,
      bookOutline, arrowForwardOutline, refreshOutline,
      playOutline, pauseOutline, stopOutline,
      volumeHighOutline, volumeMuteOutline, chevronUpOutline
    });
  }

  ngOnInit(): void {
    this.loadRenungans();
    this.initFemaleVoice();
  }

  ngOnDestroy(): void {
    this.stopTTS();
  }

  // ════════════════════════════════════════════════
  // ── Pilih voice perempuan ─────────────────────
  // ════════════════════════════════════════════════

  /**
   * Cari suara perempuan bahasa Indonesia (id-ID) dari daftar voice engine.
   *
   * Prioritas: voice yang namanya/URI-nya mengandung kata 'female', 'woman',
   * nama perempuan Indonesia, atau Google Wavenet-A/B (id-ID perempuan).
   *
   * Fallback: voice pertama yang cocok dengan id-ID / in-ID.
   * Jika tidak ada sama sekali, engine pilih default (umumnya perempuan di
   * Google TTS Android).
   */
  private async initFemaleVoice(): Promise<void> {
    try {
      const result = await TextToSpeech.getSupportedVoices();
      const voices = result?.voices ?? [];

      // Filter hanya voice bahasa Indonesia
      const idVoices = voices.filter(v => {
        const lang = (v.lang ?? '').toLowerCase();
        return lang.startsWith('id') || lang.startsWith('in-id');
      });

      if (idVoices.length === 0) return;

      // Keyword yang menandakan voice perempuan
      const femaleKeywords = [
        'female', 'woman', 'girl',
        'sri', 'sari', 'dewi', 'putri', 'kartini',
        'wanita', 'perempuan',
        // Google TTS Wavenet: A & B adalah perempuan untuk id-ID
        'wavenet-a', 'wavenet-b',
        // Samsung Bixby / Galaxy TTS
        'heera',
      ];

      const femaleVoice = idVoices.find(v => {
        const name = (v.name ?? '').toLowerCase();
        const uri  = (v.voiceURI ?? '').toLowerCase();
        return femaleKeywords.some(k => name.includes(k) || uri.includes(k));
      });

      if (femaleVoice) {
        this.selectedVoiceUri = femaleVoice.voiceURI ?? femaleVoice.name;
        console.log('[TTS] Voice perempuan dipilih:', femaleVoice.name);
      } else {
        // Fallback ke voice pertama id-ID
        this.selectedVoiceUri = idVoices[0]?.voiceURI ?? idVoices[0]?.name;
        console.log('[TTS] Fallback voice:', idVoices[0]?.name);
      }
    } catch (e) {
      console.warn('[TTS] getSupportedVoices tidak tersedia:', e);
    }
  }

  // ════════════════════════════════════════════════
  // ── TTS Controls ────────────────────────────────
  // ════════════════════════════════════════════════

  async playTTS(): Promise<void> {
    if (!this.selectedItem) return;

    const raw        = this.selectedItem.renungan_desc ?? '';
    this.ttsText     = this.preprocessTTSText(this.htmlToPlain(raw));
    this.ttsDuration = this.ttsText.length || 1;

    // Bangun index kata untuk highlight
    this.buildWordIndex(this.ttsText);

    if (!this.ttsText.trim()) {
      console.warn('[TTS] teks kosong, tidak ada yang dibaca.');
      return;
    }

    const startFrom = this.ttsPaused ? this.ttsCurrentChar : 0;
    if (!this.ttsPaused) {
      this.ttsCurrentChar   = 0;
      this.ttsProgress      = 0;
      this.ttsActiveWordIdx = -1;
    }

    this.ttsAborted = false;
    this.ttsPaused  = false;
    this.ttsPlaying = true;
    this.cdr.markForCheck();

    await this.speakFrom(startFrom);
  }

  async pauseTTS(): Promise<void> {
    if (!this.ttsPlaying) return;

    this.ttsAborted = true;

    if (this.ttsInitialized) {
      try { await TextToSpeech.stop(); } catch { /* abaikan */ }
    }

    this.stopProgressTimer();
    this.ttsPaused  = true;
    this.ttsPlaying = false;
    this.cdr.markForCheck();
  }

  async stopTTS(resetProgress = true): Promise<void> {
    this.ttsAborted = true;

    if (this.ttsInitialized) {
      try { await TextToSpeech.stop(); } catch { /* abaikan */ }
    }

    this.stopProgressTimer();
    this.ttsPlaying = false;
    this.ttsPaused  = false;

    if (resetProgress) {
      this.ttsProgress      = 0;
      this.ttsCurrentChar   = 0;
      this.ttsChunkFrom     = 0;
      this.ttsActiveWordIdx = -1;
      this.clearWordHighlights();
    }

    this.cdr.markForCheck();
  }

  async togglePlay(): Promise<void> {
    if (this.ttsPlaying) {
      await this.pauseTTS();
    } else {
      await this.playTTS();
    }
  }

  // ── Seek (tap on progress bar) ───────────────────
  async seekTo(event: MouseEvent): Promise<void> {
    const bar    = event.currentTarget as HTMLElement;
    const ratio  = Math.min(Math.max(event.offsetX / bar.offsetWidth, 0), 1);
    const target = Math.floor(ratio * this.ttsDuration);

    await this.stopTTS(false);

    this.ttsCurrentChar   = target;
    this.ttsProgress      = ratio * 100;
    this.ttsActiveWordIdx = this.charToWordIdx(target);
    this.ttsAborted       = false;
    this.ttsPaused        = false;
    this.ttsPlaying       = true;
    this.cdr.markForCheck();

    await this.speakFrom(target);
  }

  // ════════════════════════════════════════════════
  // ── Word index ────────────────────────────────
  // ════════════════════════════════════════════════

  /**
   * Bangun ttsWordOffsets: array posisi karakter awal setiap kata dalam ttsText.
   * Indeks array = indeks id span "w-N" di DOM.
   *
   * Catatan: urutan kata di DOM (dari formattedDesc) harus sama dengan urutan
   * token di sini. Keduanya memproses teks yang sama dengan regex \S+.
   */
  private buildWordIndex(text: string): void {
    this.ttsWordOffsets = [];
    this.ttsWordCount   = 0;
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      this.ttsWordOffsets.push(match.index);
      this.ttsWordCount++;
    }
  }

  /**
   * Dari posisi karakter dalam ttsText, cari kata ke-N yang paling dekat.
   */
  private charToWordIdx(charPos: number): number {
    if (!this.ttsWordOffsets.length) return -1;
    let idx = 0;
    for (let i = 0; i < this.ttsWordOffsets.length; i++) {
      if (this.ttsWordOffsets[i] <= charPos) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }

  // ════════════════════════════════════════════════
  // ── Internal: speak dari char index tertentu ────
  // ════════════════════════════════════════════════

  private async speakFrom(fromChar: number): Promise<void> {
    const chunk = this.ttsText.slice(fromChar).trim();
    if (!chunk) {
      this.zone.run(() => {
        this.ttsPlaying       = false;
        this.ttsProgress      = 100;
        this.ttsActiveWordIdx = this.ttsWordCount - 1;
        this.stopProgressTimer();
        this.cdr.markForCheck();
      });
      return;
    }

    this.ttsChunkFrom   = fromChar;
    this.ttsAborted     = false;
    this.ttsInitialized = true;
    this.startProgressTimer();

    try {
      const speakOptions: any = {
        text:     chunk,
        lang:     'id-ID',
        rate:     this.ttsRate,   // 0.72 — lambat & halus
        pitch:    1.60,           // sedikit lebih tinggi → kesan suara perempuan
        volume:   1.0,
        category: 'playback',     // tidak diam di silent mode iOS
      };

      // Sertakan voice URI perempuan jika tersedia
      if (this.selectedVoiceUri) {
        speakOptions.voice = this.selectedVoiceUri;
      }

      await TextToSpeech.speak(speakOptions);

      // Selesai dibaca secara normal
      this.zone.run(() => {
        if (this.ttsAborted) return;

        this.ttsPlaying       = false;
        this.ttsPaused        = false;
        this.ttsProgress      = 100;
        this.ttsCurrentChar   = this.ttsDuration;
        this.ttsActiveWordIdx = this.ttsWordCount - 1;
        this.stopProgressTimer();
        this.cdr.markForCheck();
      });

    } catch (err: any) {
      const msg       = (err?.message ?? '').toString().toLowerCase();
      const isStopped = msg.includes('stop')
                     || msg.includes('cancel')
                     || msg.includes('interrupted')
                     || this.ttsAborted;

      if (!isStopped) {
        console.error('[TTS] Error:', err?.message, err?.code);
      }

      this.zone.run(() => {
        if (!this.ttsPaused) {
          this.ttsPlaying = false;
        }
        this.stopProgressTimer();
        this.cdr.markForCheck();
      });
    }
  }

  // ════════════════════════════════════════════════
  // ── Progress timer ───────────────────────────────
  // ════════════════════════════════════════════════

  private startProgressTimer(): void {
    this.stopProgressTimer();
    // Estimasi: bahasa Indonesia ≈ 14 karakter/detik di rate normal.
    // Di rate 0.72 → sekitar 10 karakter/detik efektif.
    const charsPerSec = 14 * this.ttsRate;

    this.ttsTimer = setInterval(() => {
      this.zone.run(() => {
        if (!this.ttsPlaying || this.ttsPaused) return;

        this.ttsCurrentChar = Math.min(
          this.ttsCurrentChar + charsPerSec * 0.25,
          this.ttsDuration
        );
        this.ttsProgress      = (this.ttsCurrentChar / this.ttsDuration) * 100;
        this.ttsActiveWordIdx = this.charToWordIdx(this.ttsCurrentChar);

        // Scroll agar kata aktif selalu terlihat
        this.scrollToActiveWord();

        if (this.ttsProgress >= 100) this.stopProgressTimer();
        this.cdr.markForCheck();
      });
    }, 250);
  }

  private stopProgressTimer(): void {
    if (this.ttsTimer) {
      clearInterval(this.ttsTimer);
      this.ttsTimer = null;
    }
  }

  /**
   * Update class DOM secara langsung untuk kata aktif dan kata yang sudah dilewati.
   *
   * Karena konten detail-desc di-render via [innerHTML], Angular tidak bisa
   * mengelola class child-nya lewat binding biasa. Kita manipulasi DOM langsung
   * agar lebih efisien (tidak perlu re-render seluruh innerHTML).
   *
   * - Span kata aktif  → class "tts-active" (blok kuning)
   * - Span kata selesai → class "tts-done"  (kuning pudar)
   * - Scroll agar kata aktif selalu terlihat di tengah layar
   */
  private prevActiveIdx = -1;

  private scrollToActiveWord(): void {
    const idx = this.ttsActiveWordIdx;
    if (idx < 0 || idx === this.prevActiveIdx) return;

    try {
      // Hapus highlight dari kata sebelumnya
      if (this.prevActiveIdx >= 0) {
        const prev = document.getElementById(`w-${this.prevActiveIdx}`);
        if (prev) {
          prev.classList.remove('tts-active');
          prev.classList.add('tts-done');   // tandai sudah dilewati
        }
      }

      // Tambahkan highlight ke kata sekarang
      const el = document.getElementById(`w-${idx}`);
      if (el) {
        el.classList.remove('tts-done');
        el.classList.add('tts-active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      this.prevActiveIdx = idx;
    } catch { /* abaikan jika DOM belum siap */ }
  }

  /** Reset semua class highlight di DOM (dipanggil saat stop/closeDetail). */
  private clearWordHighlights(): void {
    try {
      document.querySelectorAll('.tts-word.tts-active, .tts-word.tts-done')
        .forEach(el => {
          el.classList.remove('tts-active', 'tts-done');
        });
    } catch { /* abaikan */ }
    this.prevActiveIdx = -1;
  }

  // ════════════════════════════════════════════════
  // ── Getters untuk template ───────────────────────
  // ════════════════════════════════════════════════

  get ttsProgressPct(): string {
    return this.ttsProgress.toFixed(1) + '%';
  }

  get ttsTimeLabel(): string {
    const charsPerSec = 14 * this.ttsRate;
    const totalSec    = Math.round(this.ttsDuration / charsPerSec);
    const elapsed     = Math.round(this.ttsCurrentChar / charsPerSec);
    return `${this.fmtTime(elapsed)} / ${this.fmtTime(totalSec)}`;
  }

  private fmtTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ════════════════════════════════════════════════
  // ── HTML → Plain text ───────────────────────────
  // ════════════════════════════════════════════════

  private htmlToPlain(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ════════════════════════════════════════════════
  // ── Preprocess teks untuk TTS ───────────────────
  // ════════════════════════════════════════════════

  private preprocessTTSText(text: string): string {
    return text
      .replace(/\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+):(\d+)(?:-(\d+))?\b/g,
        (_, book, ch, vs, vsEnd) =>
          vsEnd
            ? `${book} ${ch} ayat ${vs} sampai ${vsEnd}`
            : `${book} ${ch} ayat ${vs}`
      )
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[_*~`|]/g, ' ')
      .replace(/—/g, ', ')
      .replace(/–/g, ' sampai ')
      .replace(/\.\.\./g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ════════════════════════════════════════════════
  // ── Data ────────────════════════════════════════
  // ════════════════════════════════════════════════

  private async loadRenungans(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const ccId = this.storage.getUser()?.cc_id ?? 0;
      const res  = await this.api.getRenungan(ccId);

      if (res?.success) {
        this.renungans = (res.data as Renungan[]) ?? [];
      } else {
        this.renungans = [];
      }
    } catch {
      this.renungans = [];
    } finally {
      this.applyFilter();
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // ── Filter date-range ────────────────────────────

  get isFilterActive(): boolean {
    return !!(this.filterFrom || this.filterTo);
  }

  toggleDateFilter(): void {
    this.showDateFilter = !this.showDateFilter;
    this.cdr.markForCheck();
  }

  onDateChange(): void {
    this.applyFilter();
    this.cdr.markForCheck();
  }

  clearFilter(): void {
    this.filterFrom = '';
    this.filterTo   = '';
    this.applyFilter();
    this.cdr.markForCheck();
  }

  private applyFilter(): void {
    if (!this.filterFrom && !this.filterTo) {
      this.filtered = [...this.renungans];
      return;
    }
    this.filtered = this.renungans.filter(r => {
      const d = r.doc_date ?? '';
      if (this.filterFrom && d < this.filterFrom) return false;
      if (this.filterTo   && d > this.filterTo)   return false;
      return true;
    });
  }

  // ── Detail full-screen ────────────────────────────

  openDetail(item: Renungan): void {
    this.stopTTS(true);
    this.selectedItem  = item;
    this.ttsPlayerOpen = true;
    this.cdr.markForCheck();
  }

  closeDetail(): void {
    this.stopTTS(true);
    this.selectedItem = null;
    this.cdr.markForCheck();
  }

  // ── Refresh ───────────────────────────────────────

  refresh(): void {
    this.loadRenungans();
  }

  // ════════════════════════════════════════════════
  // ── Format desc dengan word-span untuk highlight ─
  // ════════════════════════════════════════════════

  /**
   * Ubah HTML konten renungan menjadi HTML dengan setiap kata dibungkus
   *   <span class="tts-word" id="w-{N}">kata</span>
   *
   * Tag HTML (<p>, <br>, <strong>, dsb.) dipertahankan utuh.
   * Indeks N harus konsisten dengan ttsWordOffsets yang dibangun dari plain text
   * yang sama — regex \S+ dipakai di kedua tempat.
   *
   * Di template: [class.tts-active]="ttsActiveWordIdx === N" ditambahkan
   * lewat CSS selektor #w-{N}.tts-active (karena innerHTML tidak bisa bind Angular).
   * Kita update class DOM langsung di scrollToActiveWord() untuk performa optimal.
   */
  formattedDesc(raw: string | null | undefined): string {
    if (!raw) return '';

    // Normalisasi ke HTML
    let html: string;
    if (raw.includes('<p>') || raw.includes('<br')) {
      html = raw;
    } else {
      const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      html = normalized
        .split(/\n\n+/)
        .map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>')
        .join('');
    }

    // Wrap setiap kata dalam teks (di luar tag HTML) dengan span bernomor
    let wordIdx = 0;
    const result = html.replace(
      /(<[^>]+>)|([^<]+)/g,
      (match, tag, text) => {
        if (tag) return tag;
        return text.replace(/(\S+)/g, (word: string) => {
          const span = `<span class="tts-word" id="w-${wordIdx}">${word}</span>`;
          wordIdx++;
          return span;
        });
      }
    );

    return result;
  }

  // ── Navigasi ──────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/home']);
  }
}