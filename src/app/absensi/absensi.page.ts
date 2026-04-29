import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-absensi',
  templateUrl: './absensi.page.html',
  styleUrls: ['./absensi.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons],
})
export class AbsensiPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
