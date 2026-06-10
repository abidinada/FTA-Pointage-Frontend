import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { RapportDetailService, SousRapportResponse } from '../rapport-detail/rapport-detail.service';
import { FindByIdPipe } from '../../pipes/find-by-id.pipe';

@Component({
  selector: 'app-responsable-rapport',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FindByIdPipe],
  templateUrl: './responsable-rapport.component.html',
  styleUrl: './responsable-rapport.component.css',
  providers: [RapportDetailService]
})
export class ResponsableRapportComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  idRapport!: number;
  rapport              = signal<any>(null);
  sousRapports         = signal<SousRapportResponse[]>([]);
  vehiculesNonAffectes = signal<any[]>([]);

  loading          = signal(false);
  error            = signal('');
  success          = signal('');
  actionInProgress = signal<number | null>(null);

  // Modal retour sous-rapport
  showRetourModal = signal(false);
  srEnRetour      = signal<SousRapportResponse | null>(null);
  motifRetour     = '';

  remorqueParTracteur: { [id: number]: number | null } = {};

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService,
    public svc: RapportDetailService
  ) {}

  ngOnInit() {
    this.idRapport = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.loadDonneesReference();
    this.load();
  }

  // ── Chargement ────────────────────────────────────────────────────

  load() {
    this.loading.set(true);
    this.error.set('');

    this.http.get<any>(`${this.apiUrl}/rapports/${this.idRapport}`).subscribe({
      next: (data) => {
        this.rapport.set(data);
        this.svc.construireMaps(data.programmes || [], this.remorqueParTracteur);
        this.calculerVehiculesNonAffectes(data.programmes || []);
        this.loading.set(false);
      },
      error: () => { this.error.set('Erreur chargement rapport'); this.loading.set(false); }
    });

    this.svc.getSousRapports(this.idRapport).subscribe({
      next: (list) => this.sousRapports.set(list),
      error: () => {}
    });
  }

  // ── Calcul véhicules non affectés ─────────────────────────────────

  calculerVehiculesNonAffectes(programmes: any[]) {
    const idsTracteurAffectes    = new Set(programmes.filter(p => p.idTracteur).map(p => p.idTracteur));
    const idsVoitureAffectees    = new Set(programmes.filter(p => p.idVoitureService).map(p => p.idVoitureService));
    const idsFournisseurAffectes = new Set(programmes.filter(p => p.idFournisseur).map(p => p.idFournisseur));

    const nonAffectes: any[] = [];

    this.svc.tracteurs.forEach(t => {
      if (!idsTracteurAffectes.has(t.idTracteur))
        nonAffectes.push({ type: 'TRACTEUR', immatriculation: t.immatriculation, id: t.idTracteur });
    });
    this.svc.voitures.forEach(v => {
      if (!idsVoitureAffectees.has(v.idVoitureService))
        nonAffectes.push({ type: 'VOITURE', immatriculation: v.immatriculation, id: v.idVoitureService });
    });
    this.svc.fournisseurs.forEach(f => {
      if (!idsFournisseurAffectes.has(f.idFournisseur))
        nonAffectes.push({ type: 'FOURNISSEUR', nom: f.nomSociete, id: f.idFournisseur });
    });

    this.vehiculesNonAffectes.set(nonAffectes);
  }

  // ── Stats ─────────────────────────────────────────────────────────

  get totalVehicules(): number {
    return this.svc.tracteurs.length + this.svc.voitures.length + this.svc.fournisseurs.length;
  }
  get nbAffectes():   number { return this.totalVehicules - this.vehiculesNonAffectes().length; }
  get tracteursNonAffectes():   any[] { return this.vehiculesNonAffectes().filter(v => v.type === 'TRACTEUR'); }
  get voituresNonAffectees():   any[] { return this.vehiculesNonAffectes().filter(v => v.type === 'VOITURE'); }
  get fournisseursNonAffectes(): any[] { return this.vehiculesNonAffectes().filter(v => v.type === 'FOURNISSEUR'); }
  get nbSoumis():     number { return this.sousRapports().filter(sr => sr.statut === 'SOUMIS').length; }
  get nbValides():    number { return this.sousRapports().filter(sr => sr.statut === 'VALIDE').length; }
  get nbRetournes():  number { return this.sousRapports().filter(sr => sr.statut === 'RETOURNE').length; }
  get nbBrouillons(): number { return this.sousRapports().filter(sr => sr.statut === 'BROUILLON').length; }

  get tousValides(): boolean {
    const list = this.sousRapports();
    return list.length > 0 && list.every(sr => sr.statut === 'VALIDE');
  }

  // ── Statut rapport ────────────────────────────────────────────────

  isBrouillon():       boolean { return this.rapport()?.statutRapport === 'BROUILLON'; }
  isTransmisQualite(): boolean { return this.rapport()?.statutRapport === 'TRANSMIS_QUALITE'; }
  isRetourne():        boolean { return this.rapport()?.statutRapport === 'RETOURNE'; }
  isTransmisRH():      boolean { return this.rapport()?.statutRapport === 'TRANSMIS_RH'; }

  // ── Actions sous-rapport ──────────────────────────────────────────

  valider(sr: SousRapportResponse) {
    this.actionInProgress.set(sr.idSousRapport);
    this.error.set('');
    this.svc.validerSousRapport(sr.idSousRapport).subscribe({
      next: () => {
        this.success.set(`Sous-rapport de ${sr.usernameAgent} validé ✓`);
        this.actionInProgress.set(null);
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err: any) => {
        this.error.set(this.svc.parseErr(err));
        this.actionInProgress.set(null);
      }
    });
  }

  openRetourModal(sr: SousRapportResponse) {
    this.srEnRetour.set(sr);
    this.motifRetour = '';
    this.error.set('');
    this.showRetourModal.set(true);
  }

  confirmerRetour() {
    if (!this.motifRetour.trim()) { this.error.set('Le motif est obligatoire'); return; }
    const sr = this.srEnRetour();
    if (!sr) return;

    this.actionInProgress.set(sr.idSousRapport);
    this.svc.retournerSousRapport(sr.idSousRapport, this.motifRetour).subscribe({
      next: () => {
        this.success.set(`Sous-rapport retourné à ${sr.usernameAgent}`);
        this.showRetourModal.set(false);
        this.actionInProgress.set(null);
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err: any) => {
        this.error.set(this.svc.parseErr(err));
        this.actionInProgress.set(null);
      }
    });
  }

  // ── Soumettre rapport global → Qualité ───────────────────────────

  soumettreGlobal() {
    this.error.set('');
    this.svc.soumettreRapportGlobal(this.idRapport).subscribe({
      next: () => {
        this.success.set('Rapport soumis à la qualité !');
        setTimeout(() => this.success.set(''), 4000);
        this.load();
      },
      error: (err: any) => this.error.set(this.svc.parseErr(err))
    });
  }

  // ── Re-soumettre après retour qualité ────────────────────────────

  resoumettreQualite() {
    this.error.set('');
    this.http.put(`${this.apiUrl}/rapports/${this.idRapport}/resoumettre`, {}).subscribe({
      next: () => {
        this.success.set('Rapport re-soumis à la qualité');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err: any) => this.error.set(this.svc.parseErr(err))
    });
  }

  // ── Voir rapport complet → redirige vers rapport-detail ──────────

  voirRapportComplet() {
    this.router.navigate(['/rapports', this.idRapport]);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  isActing(id: number): boolean { return this.actionInProgress() === id; }

  statutLabel(s: string): string {
    const m: Record<string, string> = {
      BROUILLON: 'Brouillon', SOUMIS: 'Soumis',
      RETOURNE:  'Retourné',  VALIDE: 'Validé'
    };
    return m[s] || s;
  }

  statutClass(s: string): string {
    const m: Record<string, string> = {
      BROUILLON: 'badge-brouillon', SOUMIS: 'badge-soumis',
      RETOURNE:  'badge-retourne',  VALIDE: 'badge-valide'
    };
    return m[s] || '';
  }

  rapportStatutLabel(): string {
    const m: Record<string, string> = {
      BROUILLON:        'Saisie en cours',
      TRANSMIS_QUALITE: 'Transmis Qualité',
      RETOURNE:         'Retourné par Qualité',
      TRANSMIS_RH:      'Transmis RH'
    };
    return m[this.rapport()?.statutRapport] || this.rapport()?.statutRapport || '';
  }

  rapportStatutClass(): string {
    const m: Record<string, string> = {
      BROUILLON:        'badge-brouillon',
      TRANSMIS_QUALITE: 'badge-qualite',
      RETOURNE:         'badge-retourne',
      TRANSMIS_RH:      'badge-transmis'
    };
    return m[this.rapport()?.statutRapport] || '';
  }

  getVehiculeIcon(type: string): string {
    const m: Record<string, string> = {
      TRACTEUR: 'local_shipping', VOITURE: 'directions_car', FOURNISSEUR: 'business'
    };
    return m[type] || 'help';
  }

  retournerListe() { this.router.navigate(['/rapports']); }
}