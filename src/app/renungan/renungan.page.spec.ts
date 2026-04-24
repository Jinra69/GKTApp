import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RenunganPage } from './renungan.page';

describe('RenunganPage', () => {
  let component: RenunganPage;
  let fixture: ComponentFixture<RenunganPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RenunganPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
