// pages/pengumuman/pengumuman.page.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { ApiService } from '../shared/services/api.service';
import { StorageService } from '../shared/services/storage.service';
import { PengumumanDoc, PengumumanMonthGroup, AnnouncementFull } from '../shared/interfaces/pengumuman.interface';

@Component({
  selector: 'app-pengumuman',
  templateUrl: './pengumuman.page.html',
  styleUrls: ['./pengumuman.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons],
})
export class PengumumanPage implements OnInit, OnDestroy {
  groups: PengumumanMonthGroup[] = [];
  loading = false;

  showDetail = false;
  selectedDoc: PengumumanDoc | null = null;
  detailPosterIndex = 0;
  detailPosterVisible = false;
  private detailAutoSlide: any;

  showPosterZoom = false;
  posterZoomUrl = '';
  posterZoomScale = 1;
  private pzLastTouchDist = 0;
  private pzStartScale = 1;
  private pzLastTap = 0;

  private userCcId: number | null = null;

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    addIcons({ arrowBackOutline });
  }

  ngOnInit() {
    const user = this.storage.getUser();
    if (user) this.userCcId = user.cc_id;
    this.loadData();
  }

  ngOnDestroy() {
    this.stopDetailSlide();
    for (const g of this.groups) {
      for (const doc of g.docs) this.stopDocSlide(doc);
    }
  }

  private async loadData() {
    if (!this.userCcId) return;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const data = await this.api.getAllAnnouncements(this.userCcId);
      this.ngZone.run(() => {
        if (data.success && data.data?.length) {
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
            if (item.file_image) docMap.get(item.noun_id)!.posters.push(item.file_image);
          }

          const monthMap = new Map<string, PengumumanDoc[]>();
          for (const doc of docMap.values()) {
            const key = doc.month;
            if (!monthMap.has(key)) monthMap.set(key, []);
            monthMap.get(key)!.push(doc);
          }

          this.groups = Array.from(monthMap.entries()).map(([month, docs]) => ({ month, docs }));
          for (const g of this.groups) {
            for (const doc of g.docs) this.startDocSlide(doc);
          }
        }
        this.loading = false;
        this.cdr.markForCheck();
      });
    } catch {
      this.ngZone.run(() => { this.loading = false; this.cdr.markForCheck(); });
    }
  }

  openDetail(doc: PengumumanDoc) {
    this.selectedDoc = doc;
    this.detailPosterIndex = 0;
    this.detailPosterVisible = false;
    this.showDetail = true;
    setTimeout(() => {
      this.detailPosterVisible = true;
      this.cdr.markForCheck();
      this.startDetailSlide();
    }, 100);
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedDoc = null;
    this.stopDetailSlide();
    this.cdr.markForCheck();
  }

  goToDetailPoster(i: number) {
    this.detailPosterIndex = i;
    this.stopDetailSlide();
    this.startDetailSlide();
    this.cdr.markForCheck();
  }

  private startDetailSlide() {
    this.stopDetailSlide();
    if (!this.selectedDoc || this.selectedDoc.posters.length <= 1) return;
    this.detailAutoSlide = setInterval(() => {
      if (!this.selectedDoc) return;
      this.detailPosterIndex = (this.detailPosterIndex + 1) % this.selectedDoc.posters.length;
      this.cdr.markForCheck();
    }, 3000);
  }

  private stopDetailSlide() {
    if (this.detailAutoSlide) { clearInterval(this.detailAutoSlide); this.detailAutoSlide = null; }
  }

  startDocSlide(doc: PengumumanDoc) {
    if (doc.autoSlideTimer || doc.posters.length <= 1) return;
    doc.autoSlideTimer = setInterval(() => {
      doc.currentPosterIndex = (doc.currentPosterIndex + 1) % doc.posters.length;
      this.cdr.markForCheck();
    }, 3500);
  }

  stopDocSlide(doc: PengumumanDoc) {
    if (doc.autoSlideTimer) { clearInterval(doc.autoSlideTimer); doc.autoSlideTimer = undefined; }
  }

  goToDocPoster(doc: PengumumanDoc, i: number) {
    doc.currentPosterIndex = i;
    this.stopDocSlide(doc);
    this.startDocSlide(doc);
    this.cdr.markForCheck();
  }

  openPosterZoom(url: string, event?: Event) {
    if (event) event.stopPropagation();
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

  trackByMonth = (_: number, g: PengumumanMonthGroup) => g.month;
  trackByNounId = (_: number, d: PengumumanDoc) => d.noun_id;
  trackByIndex = (i: number) => i;
}