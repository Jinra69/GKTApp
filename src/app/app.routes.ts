import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'renungan',
    loadComponent: () => import('./renungan/renungan.page').then( m => m.RenunganPage)
  },
  {
    path: 'absensi',
    loadComponent: () => import('./absensi/absensi.page').then( m => m.AbsensiPage)
  },
  {
    path: 'pengumuman',
    loadComponent: () => import('./pengumuman/pengumuman.page').then( m => m.PengumumanPage)
  },
];
