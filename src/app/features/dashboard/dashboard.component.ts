import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {

  totalChauffeurs = signal(0);
  chauffeursActifs = signal(0);
  chauffeursNationaux = signal(0);
  chauffeursInternationaux = signal(0);
  totalTracteurs = signal(0);
  totalRemorques = signal(0);
  totalVoitures = signal(0);
  totalFournisseurs = signal(0);

  // Données réelles
  derniersChauffeurs = signal<any[]>([]);
  vehiculesEnPanne = signal<any[]>([]);
  alertesVisa = signal<any[]>([]);

  today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric',
    month: 'long', day: 'numeric'
  });

  modules = [
    {
      icon: 'people', title: 'Chauffeurs',
      description: 'Gérer les chauffeurs nationaux et internationaux',
      route: '/chauffeurs', color: '#8B1A2E',
      depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'RH']
    },
    {
      icon: 'local_shipping', title: 'Tracteurs',
      description: 'Suivi et gestion du parc de tracteurs',
      route: '/tracteurs', color: '#1A3A8B',
      depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'MAINTENANCE']
    },
    {
      icon: 'inventory_2', title: 'Remorques',
      description: 'Gestion des remorques et leurs statuts',
      route: '/remorques', color: '#1A6B3A',
      depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'MAINTENANCE']
    },
    {
      icon: 'directions_car', title: 'Voitures de service',
      description: 'Gestion des voitures de service',
      route: '/voitures-service', color: '#6B4A1A',
      depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'MAINTENANCE']
    },
    {
      icon: 'business', title: 'Fournisseurs',
      description: 'Gestion des prestataires externes',
      route: '/fournisseurs', color: '#4A1A6B',
      depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE']
    },
  ];

  get modulesVisibles() {
    const dept = this.authService.getDepartement();
    return this.modules.filter(m => m.depts.includes(dept));
  }

  constructor(
    public authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
  const pannes: any[] = [];

  this.http.get<any[]>('http://localhost:8080/api/chauffeurs').subscribe({
    next: (data) => {
      this.totalChauffeurs.set(data.length);
      this.chauffeursActifs.set(data.filter(c => c.actif).length);
      this.chauffeursNationaux.set(data.filter(c => c.typeChauffeur === 'NATIONAL').length);
      this.chauffeursInternationaux.set(data.filter(c => c.typeChauffeur === 'INTERNATIONAL').length);
      const sorted = [...data].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      this.derniersChauffeurs.set(sorted.slice(0, 4));
      const today = new Date();
      const in60days = new Date();
      in60days.setDate(today.getDate() + 60);
      const alertes = data.filter(c => {
        if (c.typeChauffeur !== 'INTERNATIONAL') return false;
        if (!c.dateExpirationVisa) return true;
        return new Date(c.dateExpirationVisa) <= in60days;
      });
      this.alertesVisa.set(alertes.slice(0, 3));
    }
  });

  this.http.get<any[]>('http://localhost:8080/api/tracteurs').subscribe({
    next: (data) => {
      this.totalTracteurs.set(data.length);
      const enPanne = data
        .filter(t => t.statut === 'EN_PANNE_AUTORISE' || t.statut === 'EN_PANNE_IMMOBILISE')
        .map(t => ({ immatriculation: t.immatriculation, statut: t.statut, type: 'Tracteur' }));
      pannes.push(...enPanne);
      this.vehiculesEnPanne.set([...pannes].slice(0, 5));
    }
  });

  this.http.get<any[]>('http://localhost:8080/api/remorques').subscribe({
    next: (data) => {
      this.totalRemorques.set(data.length);
      const enPanne = data
        .filter(r => r.statutVehicule?.libelle === 'EN_PANNE_AUTORISE' ||
                     r.statutVehicule?.libelle === 'EN_PANNE_IMMOBILISE')
        .map(r => ({ immatriculation: r.immatriculation, statut: r.statutVehicule?.libelle, type: 'Remorque' }));
      pannes.push(...enPanne);
      this.vehiculesEnPanne.set([...pannes].slice(0, 5));
    }
  });

  this.http.get<any[]>('http://localhost:8080/api/voitures-service').subscribe({
    next: (data) => {
      this.totalVoitures.set(data.length);
      const enPanne = data
        .filter(v => v.statutVehicule?.libelle === 'EN_PANNE_AUTORISE' ||
                     v.statutVehicule?.libelle === 'EN_PANNE_IMMOBILISE')
        .map(v => ({ immatriculation: v.immatriculation, statut: v.statutVehicule?.libelle, type: 'Voiture' }));
      pannes.push(...enPanne);
      this.vehiculesEnPanne.set([...pannes].slice(0, 5));
    }
  });

  this.http.get<any[]>('http://localhost:8080/api/fournisseurs').subscribe({
    next: (data) => this.totalFournisseurs.set(data.length)
  });
}

  getVisaStatus(dateVisa: string): string {
    if (!dateVisa) return 'danger';
    const diff = new Date(dateVisa).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'danger';
    if (days <= 30) return 'danger';
    return 'warning';
  }

  getVisaLabel(dateVisa: string): string {
    if (!dateVisa) return 'Visa manquant';
    const diff = new Date(dateVisa).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Visa expiré';
    return `Expire dans ${days}j`;
  }
}