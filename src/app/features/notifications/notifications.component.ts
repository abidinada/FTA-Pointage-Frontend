import { Component, OnInit, signal, computed } from '@angular/core';
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

  activeTab = signal<string>('TOUS');
  dismissedIds = signal<Set<number>>(new Set());

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

  dismiss(notif: any, event: Event) {
    event.stopPropagation();
    this.dismissedIds.update(set => {
      const next = new Set(set);
      next.add(notif.idNotification);
      return next;
    });
  }

  get nonLues(): number {
    return this.notifications().filter(n => !n.lue).length;
  }

  private get notifsVisibles(): any[] {
    return this.notifications().filter(n => !this.dismissedIds().has(n.idNotification));
  }

  tabs = computed(() => {
    const all = this.notifsVisibles;
    const types = Array.from(new Set(all.map(n => n.typeNotification)));
    const base = [
      { key: 'TOUS', label: 'Tous', count: all.length },
      { key: 'NON_LUES', label: 'Non lus', count: all.filter(n => !n.lue).length },
    ];
    const typeTabs = types.map(t => ({
      key: t,
      label: this.getTypeLabel(t),
      count: all.filter(n => n.typeNotification === t).length
    }));
    return [...base, ...typeTabs];
  });

  get notifsFiltrees(): any[] {
    const tab = this.activeTab();
    const visible = this.notifsVisibles;
    if (tab === 'TOUS') return visible;
    if (tab === 'NON_LUES') return visible.filter(n => !n.lue);
    return visible.filter(n => n.typeNotification === tab);
  }

  groupesParDate = computed(() => {
    const items = this.notifsFiltrees;
    const groups: { label: string; items: any[] }[] = [];
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    const buckets: Record<string, any[]> = { "Aujourd'hui": [], "Hier": [], "Plus ancien": [] };

    for (const n of items) {
      const d = new Date(n.dateCreation);
      const dOnly = new Date(d); dOnly.setHours(0,0,0,0);
      if (dOnly.getTime() === today.getTime()) buckets["Aujourd'hui"].push(n);
      else if (dOnly.getTime() === yesterday.getTime()) buckets["Hier"].push(n);
      else buckets["Plus ancien"].push(n);
    }

    for (const label of Object.keys(buckets)) {
      if (buckets[label].length > 0) groups.push({ label, items: buckets[label] });
    }
    return groups;
  });

  selectTab(key: string) {
    this.activeTab.set(key);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'SOUMISSION_QUALITE':   return 'pending';
      case 'RETOUR_EXPLOITATION':  return 'reply';
      case 'VALIDATION_QUALITE':   return 'check_circle';
      case 'TRANSMISSION_RH':      return 'send';
      case 'PANNE_VEHICULE':       return 'build';
      case 'ABSENCE_CHAUFFEUR':    return 'person_off';
      case 'EXPIRATION_VISA':      return 'warning';
      case 'RAPPORT_ARCHIVE':      return 'archive';
      // FIX : RG-N06 - rappel maintenance panne ouverte trop longtemps
      case 'PANNE_OUVERTE_RAPPEL': return 'notification_important';
      default:                     return 'notifications';
    }
  }

  getIconColor(type: string): string {
    switch (type) {
      case 'SOUMISSION_QUALITE':   return 'color-blue';
      case 'RETOUR_EXPLOITATION':  return 'color-orange';
      case 'VALIDATION_QUALITE':   return 'color-green';
      case 'TRANSMISSION_RH':      return 'color-green';
      case 'PANNE_VEHICULE':       return 'color-red';
      case 'ABSENCE_CHAUFFEUR':    return 'color-orange';
      case 'EXPIRATION_VISA':      return 'color-red';
      case 'RAPPORT_ARCHIVE':      return 'color-gray';
      // FIX : RG-N06 - même couleur d'alerte que PANNE_VEHICULE, cohérent
      // visuellement (les deux concernent une panne active)
      case 'PANNE_OUVERTE_RAPPEL': return 'color-red';
      default:                     return 'color-gray';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'SOUMISSION_QUALITE':   return 'Soumission';
      case 'RETOUR_EXPLOITATION':  return 'Retour';
      case 'VALIDATION_QUALITE':   return 'Validation';
      case 'TRANSMISSION_RH':      return 'Transmission RH';
      case 'PANNE_VEHICULE':       return 'Panne';
      case 'ABSENCE_CHAUFFEUR':    return 'Absence';
      case 'EXPIRATION_VISA':      return 'Visa';
      case 'RAPPORT_ARCHIVE':      return 'Archive';
      case 'PANNE_OUVERTE_RAPPEL': return 'Rappel panne';
      default:                     return type;
    }
  }
}