// components/poster-slider/poster-slider.component.ts
import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Poster } from '../../shared/interfaces/pengumuman.interface';

@Component({
  selector: 'app-poster-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="poster-slider-wrap">
      <div class="poster-skeleton-wrap" *ngIf="loading">
        <div class="poster-skeleton"></div>
      </div>

      <div class="poster-empty" *ngIf="!loading && posters.length === 0">
        <div class="poster-empty-cross">✝</div>
        <p class="poster-empty-title">Kabar Terbaru Segera Hadir</p>
        <p class="poster-empty-sub">Pengumuman & poster gereja akan tampil di sini</p>
      </div>

      <ng-container *ngIf="!loading && posters.length > 0">
        <div class="poster-track"
             (touchstart)="onTouchStart($event)"
             (touchmove)="onTouchMove($event)"
             (touchend)="onTouchEnd()"
             [style.transform]="'translateX(' + (-(currentIndex * 100)) + '%)'">
          <div class="poster-slide" *ngFor="let poster of posters; let i = index" (click)="onPosterClick(poster.src, $event)">
            <img [src]="poster.src" [alt]="poster.alt" class="poster-img" loading="lazy" />
          </div>
        </div>
        <div class="poster-dots" *ngIf="posters.length > 1">
          <span class="poster-dot" *ngFor="let poster of posters; let i = index" [class.active]="i === currentIndex" (click)="goTo(i)"></span>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .poster-slider-wrap { position: relative; width: 100%; height: 160px; overflow: hidden; border-radius: 16px; margin-bottom: 26px; box-shadow: 0 6px 20px rgba(26,46,74,0.15); background: #d0d8e4; flex-shrink: 0; }
    .poster-track { display: flex; height: 100%; transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform; }
    .poster-slide { min-width: 100%; height: 100%; flex-shrink: 0; overflow: hidden; cursor: zoom-in; }
    .poster-img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; user-select: none; }
    .poster-dots { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
    .poster-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.45); cursor: pointer; transition: background 0.2s ease, width 0.2s ease; }
    .poster-dot.active { background: #C9A84C; width: 20px; border-radius: 4px; }
    .poster-skeleton-wrap { width: 100%; height: 100%; }
    .poster-skeleton { width: 100%; height: 100%; background: linear-gradient(90deg, #d0d8e4 25%, #e0e8f0 50%, #d0d8e4 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 16px; }
    .poster-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(145deg, #1A2E4A 0%, #243d60 100%); }
    .poster-empty-cross { font-size: 26px; color: #C9A84C; opacity: 0.85; animation: poster-glow 3s ease-in-out infinite; }
    .poster-empty-title { font-size: 13px; font-weight: 800; color: #fff; margin: 0; font-family: 'Poppins', sans-serif; }
    .poster-empty-sub { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); margin: 0; font-family: 'Nunito', sans-serif; text-align: center; padding: 0 24px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes poster-glow { 0%, 100% { text-shadow: 0 0 14px rgba(201,168,76,0.3); } 50% { text-shadow: 0 0 28px rgba(201,168,76,0.6); } }
  `]
})
export class PosterSliderComponent implements OnDestroy {
  @Input() posters: Poster[] = [];
  @Input() loading = false;
  @Output() posterClick = new EventEmitter<string>();

  currentIndex = 0;
  private autoTimer: any;
  private touchStartX = 0;
  private touchDeltaX = 0;
  private isDragging = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges() { 
    if (this.posters.length && !this.autoTimer) this.startAutoSlide();
  }

  ngOnDestroy() { this.stopAutoSlide(); }

  private startAutoSlide() {
    this.stopAutoSlide();
    if (this.posters.length <= 1) return;
    this.autoTimer = setInterval(() => {
      if (!this.isDragging) {
        this.currentIndex = (this.currentIndex + 1) % this.posters.length;
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  private stopAutoSlide() { if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; } }

  onTouchStart(e: TouchEvent) { this.isDragging = true; this.touchStartX = e.touches[0].clientX; this.touchDeltaX = 0; this.stopAutoSlide(); }
  onTouchMove(e: TouchEvent) { if (!this.isDragging) return; this.touchDeltaX = e.touches[0].clientX - this.touchStartX; }
  onTouchEnd() {
    this.isDragging = false;
    const threshold = 50;
    if (this.touchDeltaX > threshold) this.currentIndex = (this.currentIndex - 1 + this.posters.length) % this.posters.length;
    else if (this.touchDeltaX < -threshold) this.currentIndex = (this.currentIndex + 1) % this.posters.length;
    this.cdr.markForCheck();
    this.startAutoSlide();
  }

  goTo(index: number) { this.currentIndex = index; this.cdr.markForCheck(); this.startAutoSlide(); }
  onPosterClick(url: string, event: Event) { event.stopPropagation(); this.posterClick.emit(url); }
}