import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PengumumanPage } from './pengumuman.page';

describe('PengumumanPage', () => {
  let component: PengumumanPage;
  let fixture: ComponentFixture<PengumumanPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PengumumanPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
