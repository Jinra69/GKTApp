// components/announcement-ticker/announcement-ticker.component.ts
import { Component, Input, Output, EventEmitter, OnDestroy, OnInit, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, chevronForwardOutline, closeOutline } from 'ionicons/icons';
import { Announcement } from '../../shared/interfaces/pengumuman.interface';

type TickerPhase = 'intro' | 'paused' | 'scrolling';

@Component({
  selector: 'app-announcement-ticker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="ticker-bar" (click)="onClick()">
      <ion-icon name="megaphone-outline" class="ticker-icon"></ion-icon>
      <div class="ticker-track">
        <ng-container *ngIf="!loading">
          <div class="static-wrapper" *ngIf="phase === 'intro'">
            <span class="church-text">{{ displayText }}</span>
          </div>
          <div class="static-wrapper" *ngIf="phase === 'paused'">
            <span class="ticker-text">{{ displayText }}</span>
          </div>
          <div
            class="ticker-inner"
            *ngIf="phase === 'scrolling'"
            [style.--ticker-duration]="duration"
            (animationend)="onScrollEnd()"
          >
            <span class="ticker-text">{{ displayText }}</span>
          </div>
        </ng-container>
        <div class="ticker-skeleton" *ngIf="loading"></div>
      </div>
      <ion-icon name="chevron-forward-outline" class="ticker-arrow"></ion-icon>
    </div>

    <!-- Modal Siapakah Kami & Visi -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-card" (click)="$event.stopPropagation()">

        <div class="modal-header">
          <span class="modal-logo">✝</span>
          <span class="modal-title">SINODE GEREJA KRISTUS TUHAN</span>
          <ion-icon name="close-outline" class="modal-close" (click)="closeModal()"></ion-icon>
        </div>

        <div class="modal-body">

          <!-- Siapakah Kami -->
          <h2 class="section-heading">Siapakah Kami?</h2>

          <div class="section-block">
            <span class="section-label">Pertama</span>
            <p class="section-text">
              "Kami adalah persekutuan orang-orang yang percaya kepada Tuhan Yesus Kristus,
              yang dipanggil oleh-Nya dari segala suku, bangsa dan bahasa untuk memasyhurkan
              Injil-Nya <span class="ref">(KPR 10:36, 42; 11:20; 13:5, 42)</span>,
              memajukan pekerjaan kerohanian di dalam tubuh-Nya demi kemuliaan nama Tuhan
              <span class="ref">(Ef 4:11-16; 1 Tes 5:11)</span>, untuk membimbing tiap-tiap
              orang kepada kesempurnaan Kristus lewat pengajaran yang sehat dari firman Allah
              <span class="ref">(Kol 1:28-29)</span>, dan untuk saling tolong-menolong serta
              saling melayani <span class="ref">(2 Kor 8:13-14; Ef 6:18-20; Flp 2:19-30)</span>
              dalam kesaksian yang utuh akan Yesus Kristus di seluruh Indonesia dan sampai ke
              ujung-ujung bumi."
            </p>
          </div>

          <div class="section-block">
            <span class="section-label">Kedua</span>
            <p class="section-text">
              "Kami adalah persekutuan orang-orang yang percaya kepada Allah Bapa, Putera dan
              Roh Kudus, yang dalam Tuhan Yesus Kristus dipersatukan bersama-sama dengan semua
              saudara-saudari kami di dalam Tuhan di muka bumi ini oleh isi iman Alkitabiah yang
              sama, seperti termaktub di dalam Pengakuan Iman Rasuli, Pengakuan Iman
              Nicea-Konstantinopel, Pengakuan Iman Belgica dan Katekismus Heidelberg."
            </p>
          </div>

          <div class="divider"></div>

          <!-- Visi -->
          <h2 class="section-heading">Visi Sinode GKT</h2>

          <div class="vision-statement">
            <p class="vision-main">Gereja Reformed yang berbuah melalui kehidupan bergereja yang sehat</p>
            <p class="vision-verse">
              "Dalam hal inilah Bapa-Ku dipermuliakan, yaitu jika kamu berbuah banyak
              dan dengan demikian kamu adalah murid-murid-Ku."
            </p>
            <p class="vision-ref">— Yohanes 15:8</p>
          </div>

          <div class="pillar-block">
            <div class="pillar-header">
              <span class="pillar-icon">🙏</span>
              <div>
                <span class="pillar-title">Restorative Worship</span>
                <span class="pillar-sub">Ibadah yang membaharui</span>
              </div>
            </div>
            <p class="pillar-text">Menghadirkan gereja yang membawa pembaharuan hubungan pribadi jemaat dengan Tuhan melalui ibadah.</p>
          </div>

          <div class="pillar-block">
            <div class="pillar-header">
              <span class="pillar-icon">🤝</span>
              <div>
                <span class="pillar-title">Motivational Fellowship</span>
                <span class="pillar-sub">Persekutuan yang memotivasi</span>
              </div>
            </div>
            <p class="pillar-text">Menghadirkan gereja yang menghidupi persekutuan sebagai anggota Tubuh Kristus; saling menguatkan dan membangun satu dengan yang lain.</p>
          </div>

          <div class="pillar-block">
            <div class="pillar-header">
              <span class="pillar-icon">📖</span>
              <div>
                <span class="pillar-title">Transformative Discipleship</span>
                <span class="pillar-sub">Pemuridan yang transformatif</span>
              </div>
            </div>
            <p class="pillar-text">Menghadirkan pemuridan yang menekankan kepada perubahan hidup, pembaharuan yang nyata dalam kehidupan sehari-hari demi kemuliaan Allah. Melalui pengajaran yang berotoritaskan Alkitab, menekankan kedaulatan Allah dan kekudusan hidup dalam kehidupan berjemaat.</p>
          </div>

          <div class="pillar-block">
            <div class="pillar-header">
              <span class="pillar-icon">🙌</span>
              <div>
                <span class="pillar-title">Effective Ministry</span>
                <span class="pillar-sub">Jemaat yang melayani dengan efektif</span>
              </div>
            </div>
            <p class="pillar-text">Menghadirkan gereja yang mendorong karunia jemaatnya untuk terus berkembang dan dipakai untuk membangun dan melayani satu sama lain.</p>
          </div>

          <div class="pillar-block">
            <div class="pillar-header">
              <span class="pillar-icon">🌏</span>
              <div>
                <span class="pillar-title">Impactful Evangelism</span>
                <span class="pillar-sub">Gerakan penginjilan yang berdampak</span>
              </div>
            </div>
            <p class="pillar-text">Menghadirkan gereja yang bergairah dalam pelayanan misi secara holistik dan membawa dampak yang nyata.</p>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Ticker bar ── */
    .ticker-bar {
      position: relative;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1A2E4A;
      padding: 10px 10px;
      padding-top: calc(10px + env(safe-area-inset-top));
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(26,46,74,0.2);
      overflow: hidden;
      border-bottom:1px solid gold;
    }
    .ticker-icon { font-size: 18px; color: #C9A84C; flex-shrink: 0; animation: pulse 2s infinite; }
    .ticker-track { flex: 1; overflow: hidden; white-space: nowrap; position: relative; }
    .static-wrapper { display: flex; justify-content: center; align-items: center; width: 100%; }
    .church-text {
      color: #C9A84C;
      font-size: 15px;
      font-weight: 700;
      font-family: 'Nunito', sans-serif;
      letter-spacing: 0.5px;
      animation: fadeIn 0.4s ease forwards;
    }
    .ticker-inner {
      display: inline-block;
      white-space: nowrap;
      animation: ticker-scroll var(--ticker-duration, 25s) linear 1 forwards;
    }
    .ticker-text {
      display: inline-block;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Nunito', sans-serif;
    }
    .ticker-arrow { font-size: 16px; color: #C9A84C; flex-shrink: 0; }
    .ticker-skeleton {
      width: 100%; height: 20px; border-radius: 4px;
      background: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    /* ── Modal ── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: overlayIn 0.25s ease forwards;
    }
    .modal-card {
      background: #fff;
      width: 100%;
      max-height: 85vh;
      border-radius: 20px 20px 0 0;
      overflow-y: auto;
      animation: slideUp 0.3s ease forwards;
    }
    .modal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1A2E4A;
      padding: 16px;
      padding-top: calc(16px + env(safe-area-inset-top));
      border-radius: 20px 20px 0 0;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .modal-logo { font-size: 20px; color: #C9A84C; flex-shrink: 0; }
    .modal-title {
      flex: 1;
      color: #C9A84C;
      font-size: 13px;
      font-weight: 700;
      font-family: 'Nunito', sans-serif;
      letter-spacing: 0.5px;
    }
    .modal-close { font-size: 22px; color: #fff; cursor: pointer; flex-shrink: 0; opacity: 0.8; }
    .modal-body { padding: 20px 20px 48px; }

    /* ── Siapakah Kami ── */
    .section-heading {
      font-family: 'Nunito', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #1A2E4A;
      margin: 0 0 20px;
      text-align: center;
      letter-spacing: 0.3px;
    }
    .section-block {
      margin-bottom: 20px;
      border-left: 3px solid #C9A84C;
      padding-left: 14px;
    }
    .section-label {
      display: inline-block;
      background: #1A2E4A;
      color: #C9A84C;
      font-family: 'Nunito', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .section-text {
      font-family: 'Nunito', sans-serif;
      font-size: 13px;
      font-weight: 400;
      color: #333;
      line-height: 1.75;
      margin: 0;
      text-align: justify;
    }
    .ref { color: #C9A84C; font-weight: 700; font-size: 12px; }

    .divider { height: 1px; background: #e0e0e0; margin: 24px 0; }

    /* ── Visi ── */
    .vision-statement {
      background: #1A2E4A;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
    }
    .vision-main {
      color: #C9A84C;
      font-family: 'Nunito', sans-serif;
      font-size: 14px;
      font-weight: 700;
      margin: 0 0 10px;
      line-height: 1.5;
    }
    .vision-verse {
      color: #fff;
      font-family: 'Nunito', sans-serif;
      font-size: 12px;
      font-weight: 400;
      font-style: italic;
      margin: 0 0 4px;
      line-height: 1.6;
    }
    .vision-ref {
      color: #C9A84C;
      font-family: 'Nunito', sans-serif;
      font-size: 11px;
      font-weight: 700;
      margin: 0;
    }

    /* ── Pilar ── */
    .pillar-block {
      margin-bottom: 16px;
      padding: 14px;
      border-radius: 10px;
      background: #f9f7f2;
      border-left: 4px solid #C9A84C;
    }
    .pillar-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .pillar-icon { font-size: 22px; flex-shrink: 0; }
    .pillar-title {
      display: block;
      font-family: 'Nunito', sans-serif;
      font-size: 13px;
      font-weight: 800;
      color: #1A2E4A;
    }
    .pillar-sub {
      display: block;
      font-family: 'Nunito', sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #C9A84C;
      margin-top: 1px;
    }
    .pillar-text {
      font-family: 'Nunito', sans-serif;
      font-size: 12px;
      font-weight: 400;
      color: #555;
      line-height: 1.7;
      margin: 0;
      text-align: justify;
    }

    /* ── Animasi ── */
    @keyframes ticker-scroll { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  `]
})
export class AnnouncementTickerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() announcements: Announcement[] = [];
  @Input() loading = false;

  readonly CHURCH_NAME    = 'SINODE GEREJA KRISTUS TUHAN';
  readonly INTRO_PAUSE_MS = 10000;
  readonly ITEM_PAUSE_MS  = 8000;

  @Output() clickAnnouncement = new EventEmitter<Announcement>();

  displayText = '';
  duration    = '25s';
  phase: TickerPhase = 'intro';
  showModal   = false;

  private currentIndex = 0;
  private timer: any   = null;
  private initialized  = false;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {
    addIcons({ megaphoneOutline, chevronForwardOutline, closeOutline });
  }

  ngOnInit(): void    { if (this.announcements.length) this.init(); }
  ngOnChanges(): void { if (this.announcements.length && !this.initialized) this.init(); }
  ngOnDestroy(): void { this.clearTimer(); }

  onClick(): void {
    if (this.phase === 'intro') {
      this.showModal = true;
      this.cdr.markForCheck();
    } else if (this.announcements[this.currentIndex]) {
      this.clickAnnouncement.emit(this.announcements[this.currentIndex]);
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.cdr.markForCheck();
  }

  onScrollEnd(): void {
    this.ngZone.run(() => {
      this.phase = 'paused';
      this.cdr.markForCheck();

      this.clearTimer();
      this.timer = setTimeout(() => {
        this.ngZone.run(() => {
          this.currentIndex++;
          if (this.currentIndex >= this.announcements.length) {
            this.currentIndex = 0;
            this.showIntro();
          } else {
            this.displayText = this.announcements[this.currentIndex].noun_title;
            this.calcDuration();
            this.phase = 'scrolling';
            this.cdr.markForCheck();
          }
        });
      }, this.ITEM_PAUSE_MS);
    });
  }

  private init(): void {
    this.initialized = true;
    this.currentIndex = 0;
    this.showIntro();
  }

  private showIntro(): void {
    this.displayText = this.CHURCH_NAME;
    this.phase = 'intro';
    this.cdr.markForCheck();

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.ngZone.run(() => {
        this.displayText = this.announcements[this.currentIndex].noun_title;
        this.calcDuration();
        this.phase = 'scrolling';
        this.cdr.markForCheck();
      });
    }, this.INTRO_PAUSE_MS);
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private calcDuration(): void {
    this.duration = `${Math.max(10, Math.ceil(this.displayText.length * 0.15))}s`;
  }
}