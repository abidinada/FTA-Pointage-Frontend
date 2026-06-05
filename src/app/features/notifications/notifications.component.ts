import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  notifications = signal<any[]>([]);
  loading = signal(false);
  error = signal('');

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.loading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/notifications/mes-notifications`).subscribe({
      next: (data) => { this.notifications.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  marquerLue(notif: any) {
    if (notif.lue) return;
    this.http.put(`${this.apiUrl}/notifications/${notif.idNotification}/lue`, {}).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => n.idNotification === notif.idNotification ? { ...n, lue: true } : n)
        );
      }
    });
  }

  marquerToutesLues() {
    this.http.put(`${this.apiUrl}/notifications/toutes-lues`, {}).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, lue: true })));
      }
    });
  }

  get nonLues(): number {
    return this.notifications().filter(n => !n.lue).length;
  }

  get notifsFiltrees(): any[] {
    return this.notifications();
  }

  getIcon(type: string): string {
    switch (type) {
      case 'SOUMISSION_QUALITE':  return 'pending';
      case 'RETOUR_EXPLOITATION': return 'reply';
      case 'VALIDATION_QUALITE':  return 'check_circle';
      case 'TRANSMISSION_RH':     return 'send';
      case 'PANNE_VEHICULE':      return 'build';
      case 'ABSENCE_CHAUFFEUR':   return 'person_off';
      case 'EXPIRATION_VISA':     return 'warning';
      case 'RAPPORT_ARCHIVE':     return 'archive';
      default:                    return 'notifications';
    }
  }

  getIconColor(type: string): string {
    switch (type) {
      case 'SOUMISSION_QUALITE':  return 'color-blue';
      case 'RETOUR_EXPLOITATION': return 'color-orange';
      case 'VALIDATION_QUALITE':  return 'color-green';
      case 'TRANSMISSION_RH':     return 'color-green';
      case 'PANNE_VEHICULE':      return 'color-red';
      case 'ABSENCE_CHAUFFEUR':   return 'color-orange';
      case 'EXPIRATION_VISA':     return 'color-red';
      case 'RAPPORT_ARCHIVE':     return 'color-gray';
      default:                    return 'color-gray';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'SOUMISSION_QUALITE':  return 'Soumission';
      case 'RETOUR_EXPLOITATION': return 'Retour';
      case 'VALIDATION_QUALITE':  return 'Validation';
      case 'TRANSMISSION_RH':     return 'Transmission RH';
      case 'PANNE_VEHICULE':      return 'Panne';
      case 'ABSENCE_CHAUFFEUR':   return 'Absence';
      case 'EXPIRATION_VISA':     return 'Visa';
      case 'RAPPORT_ARCHIVE':     return 'Archive';
      default:                    return type;
    }
  }
}