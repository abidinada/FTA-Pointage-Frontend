import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

interface Reparation {
  idReparation:       number;
  dateReparation:     string;
  cloture:            boolean;
}

interface Panne {
  idPanne:              number;
  typeVehicule:         string;
  idVehicule:           number;
  immatriculation:      string;
  statutVehiculeActuel: string;
  dateDebut:            string;
  dateFin:              string | null;
  description:          string;
  usernameCreateur:     string;
  cloturee:              boolean;
  reparations:          Reparation[];
}

// Format brut tel que renvoyé par chaque endpoint backend.
// /api/tracteurs                -> statut: string (déjà à plat)
// /api/remorques                -> statutVehicule: { idStatutVehicule, libelle } (entité JPA)
// /api/voitures-service         -> statutVehicule: { idStatutVehicule, libelle } (entité JPA)
interface VehiculeRaw {
  idTracteur?: number;
  idRemorque?: number;
  idVoitureService?: number;
  immatriculation: string;
  statut?: string;
  statutVehicule?: { idStatutVehicule: number; libelle: string };
}

// Format interne unifié utilisé dans tout le reste du composant (inchangé).
interface Vehicule {
  idTracteur?: number;
  idRemorque?: number;
  idVoitureService?: number;
  immatriculation: string;
  statut: string;
}

@Component({
  selector: 'app-pannes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './pannes.component.html',
  styleUrl: './pannes.component.css'
})
export class PannesComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  pannes      = signal<Panne[]>([]);
  tracteurs   = signal<Vehicule[]>([]);
  remorques   = signal<Vehicule[]>([]);
  voitures    = signal<Vehicule[]>([]);

  loading     = signal(false);
  error       = signal('');
  success     = signal('');

  filtreStatut = signal<'TOUTES' | 'OUVERTES' | 'CLOTUREES'>('OUVERTES');
  filtreType   = signal('');

  showPanneModal = signal(false);
  saving         = signal(false);
  panneForm = {
    typeVehicule: 'TRACTEUR' as 'TRACTEUR' | 'REMORQUE' | 'VOITURE_SERVICE',
    idVehicule:   null as number | null,
    dateDebut:    new Date().toISOString().split('T')[0],
    description:  '',
    statutChoisi: 'EN_PANNE_IMMOBILISE'
  };

  pannesFiltrees = computed(() => {
    let list = this.pannes();
    const statut = this.filtreStatut();
    if (statut === 'OUVERTES')   list = list.filter(p => !p.cloturee);
    if (statut === 'CLOTUREES')  list = list.filter(p => p.cloturee);
    const type = this.filtreType();
    if (type) list = list.filter(p => p.typeVehicule === type);
    return list;
  });

  // ── Graphique mensuel (Signalées / Résolues) ──────────────────────

  currentYear = new Date().getFullYear();
  private readonly moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  private getDateClotureReparation(p: Panne): Date | null {
    const clot = p.reparations.find(r => r.cloture);
    if (clot) return new Date(clot.dateReparation);
    if (p.dateFin) return new Date(p.dateFin);
    return null;
  }

  monthlyChart = computed(() => {
    const now = new Date();
    const months: { label: string; signalees: number; resolues: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const signalees = this.pannes().filter(p => {
        const pd = new Date(p.dateDebut);
        return pd.getFullYear() === y && pd.getMonth() === m;
      }).length;
      const resolues = this.pannes().filter(p => {
        if (!p.cloturee) return false;
        const cd = this.getDateClotureReparation(p);
        return cd && cd.getFullYear() === y && cd.getMonth() === m;
      }).length;
      months.push({ label: this.moisLabels[m], signalees, resolues });
    }
    return months;
  });

  monthlyChartMax = computed(() => {
    const m = this.monthlyChart();
    return Math.max(1, ...m.map(x => Math.max(x.signalees, x.resolues)));
  });

  // ── Répartition par catégorie de véhicule ─────────────────────────

  categoryBreakdown = computed(() => {
    const counts: Record<string, number> = { TRACTEUR: 0, REMORQUE: 0, VOITURE_SERVICE: 0 };
    this.pannes().forEach(p => { counts[p.typeVehicule] = (counts[p.typeVehicule] || 0) + 1; });
    const colors: Record<string, string> = { TRACTEUR: '#d03b3b', REMORQUE: '#2563eb', VOITURE_SERVICE: '#f59e0b' };
    const labels: Record<string, string> = { TRACTEUR: 'Tracteurs', REMORQUE: 'Remorques', VOITURE_SERVICE: 'Voitures de service' };
    return Object.keys(counts)
      .map(k => ({ key: k, label: labels[k], count: counts[k], color: colors[k] }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  });

  categoryDonutSegments = computed(() => {
    const data = this.categoryBreakdown();
    const total = data.reduce((s, d) => s + d.count, 0);

    if (total === 0) return { mode: 'empty' as const, segments: [] as { path: string; color: string }[], singleColor: '' };
    if (data.length === 1) return { mode: 'single' as const, segments: [], singleColor: data[0].color };

    const center = 110, radius = 75, explode = 4;
    let startAngle = 0;
    const segments = data.map(d => {
      const angle = (d.count / total) * 360;
      const endAngle = startAngle + angle;
      const midAngle = startAngle + angle / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const offsetX = Math.cos(rad) * explode;
      const offsetY = Math.sin(rad) * explode;
      const path = this.describeSlice(center + offsetX, center + offsetY, radius, startAngle, endAngle);
      startAngle = endAngle;
      return { path, color: d.color };
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

  // ── Taux résolution + sparkline cette semaine ─────────────────────

  private weekDays(): Date[] {
    const now = new Date();
    const dayIdx = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIdx);
    monday.setHours(0, 0, 0, 0);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }

  weeklyResolutionSpark = computed(() => {
    const days = this.weekDays();
    const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    return days.map((d, i) => {
      const count = this.pannes().filter(p => {
        if (!p.cloturee) return false;
        const cd = this.getDateClotureReparation(p);
        return cd && cd.toDateString() === d.toDateString();
      }).length;
      return { label: dayLabels[i], count };
    });
  });

  weeklySparkMax = computed(() => Math.max(1, ...this.weeklyResolutionSpark().map(x => x.count)));

  tauxResolutionSemaine = computed(() => {
    const days = this.weekDays();
    const start = days[0];
    const end = new Date(days[6]);
    end.setHours(23, 59, 59, 999);

    const enCoursPendantSemaine = this.pannes().filter(p => {
      const pd = new Date(p.dateDebut);
      if (pd > end) return false;
      if (!p.cloturee) return true;
      const cd = this.getDateClotureReparation(p);
      return !cd || cd >= start;
    });

    const resoluesCetteSemaine = enCoursPendantSemaine.filter(p => {
      if (!p.cloturee) return false;
      const cd = this.getDateClotureReparation(p);
      return cd && cd >= start && cd <= end;
    });

    if (enCoursPendantSemaine.length === 0) return 0;
    return Math.round((resoluesCetteSemaine.length / enCoursPendantSemaine.length) * 100);
  });

  constructor(
    private http: HttpClient,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.charger();
    this.chargerVehicules();
  }

  charger() {
    this.loading.set(true);
    this.http.get<Panne[]>(`${this.apiUrl}/pannes`).subscribe({
      next: (d) => { this.pannes.set(d); this.loading.set(false); },
      error: ()  => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  // FIX : normalisation à la réception — /api/tracteurs renvoie `statut` en string
  // directe, tandis que /api/remorques et /api/voitures-service renvoient l'entité
  // JPA brute avec `statutVehicule: { idStatutVehicule, libelle }`. On aplatit les
  // trois vers le même format Vehicule { statut: string } pour que tout le reste
  // du composant (et le template HTML) n'ait jamais à connaître cette différence.
  private normaliserVehicule(v: VehiculeRaw): Vehicule {
    return {
      idTracteur:       v.idTracteur,
      idRemorque:       v.idRemorque,
      idVoitureService: v.idVoitureService,
      immatriculation:  v.immatriculation,
      statut:           v.statut ?? v.statutVehicule?.libelle ?? ''
    };
  }

  chargerVehicules() {
    this.http.get<VehiculeRaw[]>(`${this.apiUrl}/tracteurs`).subscribe({
      next: (d) => this.tracteurs.set(d.map(v => this.normaliserVehicule(v)))
    });
    this.http.get<VehiculeRaw[]>(`${this.apiUrl}/remorques`).subscribe({
      next: (d) => this.remorques.set(d.map(v => this.normaliserVehicule(v)))
    });
    this.http.get<VehiculeRaw[]>(`${this.apiUrl}/voitures-service`).subscribe({
      next: (d) => this.voitures.set(d.map(v => this.normaliserVehicule(v)))
    });
  }

  isMaintenance(): boolean { return this.authService.getDepartement() === 'MAINTENANCE'; }
  canEdit():       boolean { return this.isMaintenance(); }

  getVehiculesPourType(type: string): Vehicule[] {
    const filtre = (v: Vehicule) =>
      !v.statut.includes('EN_PANNE') && v.statut !== 'HORS_SERVICE' && v.statut !== 'VENDU';
    if (type === 'TRACTEUR') return this.tracteurs().filter(filtre);
    if (type === 'REMORQUE') return this.remorques().filter(filtre);
    return this.voitures().filter(filtre);
  }

  getStatutLibelle(v: Vehicule): string {
    return v.statut || '';
  }

  getVehiculeId(v: Vehicule): number {
    return v.idTracteur ?? v.idRemorque ?? v.idVoitureService ?? 0;
  }

  openPanneModal() {
    this.panneForm = {
      typeVehicule: 'TRACTEUR',
      idVehicule:   null,
      dateDebut:    new Date().toISOString().split('T')[0],
      description:  '',
      statutChoisi: 'EN_PANNE_IMMOBILISE'
    };
    this.error.set('');
    this.showPanneModal.set(true);
  }

  creerPanne() {
    if (!this.panneForm.idVehicule) {
      this.error.set('Sélectionnez un véhicule'); return;
    }

    const body: any = {
      dateDebut:    this.panneForm.dateDebut,
      description:  this.panneForm.description || null,
      statutChoisi: this.panneForm.statutChoisi
    };
    if (this.panneForm.typeVehicule === 'TRACTEUR')        body.idTracteur = this.panneForm.idVehicule;
    if (this.panneForm.typeVehicule === 'REMORQUE')        body.idRemorque = this.panneForm.idVehicule;
    if (this.panneForm.typeVehicule === 'VOITURE_SERVICE') body.idVoitureService = this.panneForm.idVehicule;

    this.saving.set(true);
    this.http.post<Panne>(`${this.apiUrl}/pannes`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.showPanneModal.set(false);
        this.success.set('Panne signalée');
        setTimeout(() => this.success.set(''), 3000);
        this.charger();
        this.chargerVehicules();
      },
      error: (err) => { this.saving.set(false); this.error.set(this.parseErr(err)); }
    });
  }

  ouvrirDetail(p: Panne) {
    this.router.navigate(['/pannes', p.idPanne]);
  }

  getTypeVehiculeLabel(type: string): string {
    const m: Record<string, string> = {
      TRACTEUR: 'Tracteur', REMORQUE: 'Remorque', VOITURE_SERVICE: 'Voiture de service'
    };
    return m[type] || type;
  }

  getTypeVehiculeIcon(type: string): string {
    const m: Record<string, string> = {
      TRACTEUR: 'local_shipping', REMORQUE: 'rv_hookup', VOITURE_SERVICE: 'directions_car'
    };
    return m[type] || 'help';
  }

  getStatutClass(statut: string): string {
    const m: Record<string, string> = {
      EN_PANNE_IMMOBILISE: 'statut-immobilise',
      EN_PANNE_AUTORISE:   'statut-autorise',
      DISPONIBLE:          'statut-disponible'
    };
    return m[statut] || '';
  }

  getStatutLabel(statut: string): string {
    const m: Record<string, string> = {
      EN_PANNE_IMMOBILISE: 'Immobilisé', EN_PANNE_AUTORISE: 'Autorisé', DISPONIBLE: 'Disponible'
    };
    return m[statut] || statut;
  }

  getNbJoursOuvert(p: Panne): number {
    const debut = new Date(p.dateDebut);
    const fin = p.cloturee && p.reparations.length > 0
      ? new Date(p.reparations[p.reparations.length - 1].dateReparation)
      : new Date();
    return Math.max(0, Math.floor((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)));
  }

  get nbOuvertes(): number { return this.pannes().filter(p => !p.cloturee).length; }
  get nbImmobilisees(): number {
    return this.pannes().filter(p => !p.cloturee && p.statutVehiculeActuel === 'EN_PANNE_IMMOBILISE').length;
  }
  get nbAutorisees(): number {
    return this.pannes().filter(p => !p.cloturee && p.statutVehiculeActuel === 'EN_PANNE_AUTORISE').length;
  }
  get nbCloturees(): number { return this.pannes().filter(p => p.cloturee).length; }

  private parseErr(err: any): string {
    return err?.error?.message || err?.error || 'Une erreur est survenue';
  }
}