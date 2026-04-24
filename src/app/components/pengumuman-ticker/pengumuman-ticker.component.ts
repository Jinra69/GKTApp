// components/announcement-ticker/announcement-ticker.component.ts
import { Component, Input, Output, EventEmitter, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, chevronForwardOutline } from 'ionicons/icons';
import { Announcement } from '../../shared/interfaces/pengumuman.interface';

@Component({
  selector: 'app-announcement-ticker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="ticker-bar" (click)="onClick()">
      <ion-icon name="megaphone-outline" class="ticker-icon"></ion-icon>
      <div class="ticker-track">
        <div class="ticker-inner" *ngIf="!loading" [class.ticker-hidden]="!visible" [style.--ticker-duration]="duration">
          <span class="ticker-text">{{ displayText }}</span>
        </div>
        <div class="ticker-skeleton" *ngIf="loading"></div>
      </div>
      <ion-icon name="chevron-forward-outline" class="ticker-arrow"></ion-icon>
    </div>
  `,
  styles: [`
    .ticker-bar {
      position: relative;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1A2E4A;
      padding: 10px 10px;
      padding-top: calc(10px + env(safe-area-inset-top)); // TAMBAHKAN INI
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(26,46,74,0.2);
      overflow: hidden;
    }
    .ticker-icon { font-size: 18px; color: #C9A84C; flex-shrink: 0; animation: pulse 2s infinite; }
    .ticker-track { flex: 1; overflow: hidden; white-space: nowrap; }
    .ticker-inner {
      display: inline-block; white-space: nowrap;
      animation: ticker-scroll var(--ticker-duration, 25s) linear 1 forwards;
      transition: opacity 0.4s ease;
    }
    .ticker-inner.ticker-hidden { opacity: 0; animation-play-state: paused; }
    .ticker-text { display: inline-block; color: #fff; font-size: 13px; font-weight: 600; font-family: 'Nunito', sans-serif; }
    .ticker-arrow { font-size: 16px; color: #C9A84C; flex-shrink: 0; }
    .ticker-skeleton { width: 100%; height: 20px; background: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
    @keyframes ticker-scroll { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  `]
})
export class AnnouncementTickerComponent implements OnInit, OnDestroy {
  @Input() announcements: Announcement[] = [];
  @Input() loading = false;
  @Output() clickAnnouncement = new EventEmitter<Announcement>();

  displayText = '';
  duration = '25s';
  visible = true;
  private currentIndex = 0;
  private cycleTimer: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {
    addIcons({ megaphoneOutline, chevronForwardOutline });
  }

  ngOnInit() { if (this.announcements.length) this.startCycle(); }
  ngOnDestroy() { this.stopCycle(); }

  ngOnChanges() {
    if (this.announcements.length && !this.displayText) {
      this.displayText = this.announcements[0].noun_title;
      this.calcDuration();
      this.startCycle();
    }
  }

  onClick() {
    if (this.announcements[this.currentIndex]) {
      this.clickAnnouncement.emit(this.announcements[this.currentIndex]);
    }
  }

  private startCycle() {
    this.stopCycle();
    if (this.announcements.length <= 1) return;
    
    const displayMs = parseInt(this.duration) * 1000;
    this.cycleTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.visible = false;
        this.cdr.markForCheck();
        
        setTimeout(() => {
          this.currentIndex = (this.currentIndex + 1) % this.announcements.length;
          this.displayText = this.announcements[this.currentIndex].noun_title;
          this.calcDuration();
          this.visible = true;
          this.cdr.markForCheck();
          this.startCycle();
        }, 1000);
      });
    }, displayMs);
  }

  private stopCycle() { if (this.cycleTimer) { clearTimeout(this.cycleTimer); this.cycleTimer = null; } }
  private calcDuration() { this.duration = `${Math.max(10, Math.ceil(this.displayText.length * 0.15))}s`; }
}