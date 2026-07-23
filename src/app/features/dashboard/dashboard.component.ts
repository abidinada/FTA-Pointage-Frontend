import { Component, OnInit, signal, computed } from '@angular/core';
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

  // FIX (a) : fenêtre d'alerte alignée sur le palier "avertissement" backend
  // (40j — RG-C07 révisé). Liste complète conservée (pas de slice ici) pour
  // connaître totalAlertesVisa() ; FIX (b) révisé : au-delà de 3, le lien
  // "voir tout" navigue vers /chauffeurs?visaAlerte=true plutôt qu'un
  // accordéon inline (liste réelle potentiellement longue).
  alertesVisa = signal<any[]>([]);

  alertesVisaAffichees = computed(() => this.alertesVisa().slice(0, 3));
  totalAlertesVisa = computed(() => this.alertesVisa().length);

  // État du parc véhicules
  parcDisponible = signal(0);
  parcPanneAutorise = signal(0);
  parcPanneImmobilise = signal(0);
  parcAutre = signal(0);

  totalParc = computed(() =>
    this.parcDisponible() + this.parcPanneAutorise() + this.parcPanneImmobilise() + this.parcAutre()
  );

  pourcentageDisponible = computed(() =>
    this.totalParc() > 0 ? Math.round((this.parcDisponible() / this.totalParc()) * 100) : 0
  );

  pourcentageActifsChauffeurs = computed(() =>
    this.totalChauffeurs() > 0 ? Math.round((this.chauffeursActifs() / this.totalChauffeurs()) * 100) : 0
  );

  private dataTracteurs: any[] = [];
  private dataRemorques: any[] = [];
  private dataVoitures: any[] = [];

  readonly parcCenter = 110;
  readonly parcRadius = 75;
  readonly parcExplode = 4;

  parcVisual = computed(() => {
    const total = this.totalParc();
    const data = [
      { value: this.parcDisponible(), color: '#0ca30c' },
      { value: this.parcPanneAutorise(), color: '#fab219' },
      { value: this.parcPanneImmobilise(), color: '#d03b3b' },
      { value: this.parcAutre(), color: '#9CA3AF' },
    ].filter(d => d.value > 0);

    if (total === 0) {
      return { mode: 'empty' as const, segments: [], singleColor: '' };
    }
    if (data.length === 1) {
      return { mode: 'single' as const, segments: [], singleColor: data[0].color };
    }

    const segments: { path: string; color: string }[] = [];
    let startAngle = 0;

    data.forEach(d => {
      const angle = (d.value / total) * 360;
      const endAngle = startAngle + angle;
      const midAngle = startAngle + angle / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const offsetX = Math.cos(rad) * this.parcExplode;
      const offsetY = Math.sin(rad) * this.parcExplode;
      const path = this.describeSlice(
        this.parcCenter + offsetX,
        this.parcCenter + offsetY,
        this.parcRadius,
        startAngle,
        endAngle
      );
      segments.push({ path, color: d.color });
      startAngle = endAngle;
    });

    return { mode: 'multi' as const, segments, singleColor: '' };
  });

  private polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
  }

  private describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(cx, cy, r, endAngle);
    const end = this.polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  }

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

        // FIX (a) : fenêtre 40j (palier "avertissement" backend), au lieu de 60j
        const today = new Date();
        const in40days = new Date();
        in40days.setDate(today.getDate() + 40);
        const alertes = data.filter(c => {
          if (c.typeChauffeur !== 'INTERNATIONAL') return false;
          if (!c.dateExpirationVisa) return true;
          return new Date(c.dateExpirationVisa) <= in40days;
        });
        // FIX (b) : liste complète conservée, pas de slice ici
        this.alertesVisa.set(alertes);
      }
    });

    this.http.get<any[]>('http://localhost:8080/api/tracteurs').subscribe({
      next: (data) => {
        this.totalTracteurs.set(data.length);
        this.dataTracteurs = data;
        this.calculerEtatParc();
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
        this.dataRemorques = data;
        this.calculerEtatParc();
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
        this.dataVoitures = data;
        this.calculerEtatParc();
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

  calculerEtatParc() {
    let disponible = 0, autorise = 0, immobilise = 0, autre = 0;

    const classer = (statut: string | undefined) => {
      if (statut === 'DISPONIBLE') disponible++;
      else if (statut === 'EN_PANNE_AUTORISE') autorise++;
      else if (statut === 'EN_PANNE_IMMOBILISE') immobilise++;
      else autre++;
    };

    this.dataTracteurs.forEach(t => classer(t.statut));
    this.dataRemorques.forEach(r => classer(r.statutVehicule?.libelle));
    this.dataVoitures.forEach(v => classer(v.statutVehicule?.libelle));

    this.parcDisponible.set(disponible);
    this.parcPanneAutorise.set(autorise);
    this.parcPanneImmobilise.set(immobilise);
    this.parcAutre.set(autre);
  }

  // Seuil "danger" reste à 30j ; ce qui est dans la fenêtre affichée
  // (<=40j) mais >30j est donc "warning" par déduction.
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