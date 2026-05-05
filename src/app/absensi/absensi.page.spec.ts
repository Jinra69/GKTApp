import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbsensiPage } from './absensi.page';

describe('AbsensiPage', () => {
  let component: AbsensiPage;
  let fixture: ComponentFixture<AbsensiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AbsensiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to kamera tab', () => {
    expect(component.activeTab).toBe('kamera');
  });

  it('should switch tab to qrcode', () => {
    component.switchTab('qrcode');
    expect(component.activeTab).toBe('qrcode');
  });

  it('should toggle history panel', () => {
    expect(component.historyOpen).toBeFalse();
    component.toggleHistory();
    expect(component.historyOpen).toBeTrue();
    component.toggleHistory();
    expect(component.historyOpen).toBeFalse();
  });
});