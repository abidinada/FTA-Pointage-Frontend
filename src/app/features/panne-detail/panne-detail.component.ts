import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Reparation {
  idReparation:       number;
  idAtelier:          number;
  nomAtelier:         string;
  typeAtelier:        string;
  dateReparation:     string;
  descriptionTravaux: string;
  technicien:         string;
  usernameCreateur:   string;
  cloture:            boolean;
}

interface Remplacement {
  idRemplacement:          number;
  idTracteur:              number;
  immatriculationTracteur: string;
  dateDebut:               string;
  dateFin:                 string | null;
  commentaire:             string;
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
  cloturee:             boolean;
  reparations:          Reparation[];
  remplacement:         Remplacement | null;
}

// FIX : statut est une string directe (correspond à TracteurResponse.statut)
interface Vehicule {
  idTracteur?: number;
  idRemorque?: number;
  idVoitureService?: number;
  immatriculation: string;
  statut: string;
}

interface Atelier {
  idAtelier: number;
  nom:       string;
  adresse:   string;
  type:      string;
}

@Component({
  selector: 'app-panne-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './panne-detail.component.html',
  styleUrl: './panne-detail.component.css'
})
export class PannesDetailComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  panne    = signal<Panne | null>(null);
  tracteurs = signal<Vehicule[]>([]);
  ateliers  = signal<Atelier[]>([]);

  loading  = signal(false);
  error    = signal('');
  success  = signal('');

  // FIX : filtre direct sur t.statut (string directe)
  tracteursDisponibles = computed(() =>
    this.tracteurs().filter(t => t.statut === 'DISPONIBLE')
  );

  showReparationModal   = signal(false);
  showRemplacementModal = signal(false);

  reparationForm = {
    idAtelier:          null as number | null,
    dateReparation:     new Date().toISOString().split('T')[0],
    descriptionTravaux: '',
    technicien:         '',
    cloture:            false
  };

  remplacementForm = {
    idTracteur:  null as number | null,
    dateDebut:   new Date().toISOString().split('T')[0],
    dateFin:     '',
    commentaire: ''
  };

  constructor(
    private http:        HttpClient,
    private route:       ActivatedRoute,
    private router:      Router,
    public  authService: AuthService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.chargerPanne(+id);
    }
    this.chargerTracteurs();
    this.chargerAteliers();
  }

  // ── Chargement ────────────────────────────────────────────────────

  chargerPanne(id: number) {
    this.loading.set(true);
    this.http.get<Panne>(`${this.apiUrl}/pannes/${id}`).subscribe({
      next: (d) => { this.panne.set(d); this.loading.set(false); },
      error: ()  => { this.error.set('Erreur chargement panne'); this.loading.set(false); }
    });
  }

  chargerTracteurs() {
    this.http.get<Vehicule[]>(`${this.apiUrl}/tracteurs`).subscribe({
      next: (d) => this.tracteurs.set(d)
    });
  }

  chargerAteliers() {
    this.http.get<Atelier[]>(`${this.apiUrl}/ateliers`).subscribe({
      next: (d) => this.ateliers.set(d)
    });
  }

  retour() {
    this.router.navigate(['/pannes']);
  }

  // ── Droits ────────────────────────────────────────────────────────

  isMaintenance(): boolean { return this.authService.getDepartement() === 'MAINTENANCE'; }
  canEdit():       boolean { return this.isMaintenance(); }

  // ── Changer statut ────────────────────────────────────────────────

  changerStatutVehicule(nouveauStatut: string) {
    const p = this.panne();
    if (!p) return;
    this.http.put<Panne>(`${this.apiUrl}/pannes/${p.idPanne}/statut`, { statut: nouveauStatut }).subscribe({
      next: () => {
        this.success.set('Statut mis à jour');
        setTimeout(() => this.success.set(''), 3000);
        this.chargerPanne(p.idPanne);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Réparation ────────────────────────────────────────────────────

  openReparationModal() {
    this.reparationForm = {
      idAtelier: null, dateReparation: new Date().toISOString().split('T')[0],
      descriptionTravaux: '', technicien: '', cloture: false
    };
    this.error.set('');
    this.showReparationModal.set(true);
  }

  ajouterReparation() {
    const p = this.panne();
    if (!p) return;
    if (!this.reparationForm.idAtelier) { this.error.set('Sélectionnez un atelier'); return; }

    const body = {
      idPanne:            p.idPanne,
      idAtelier:          this.reparationForm.idAtelier,
      dateReparation:     this.reparationForm.dateReparation,
      descriptionTravaux: this.reparationForm.descriptionTravaux || null,
      technicien:         this.reparationForm.technicien || null,
      cloture:            this.reparationForm.cloture
    };

    this.http.post<Reparation>(`${this.apiUrl}/pannes/reparations`, body).subscribe({
      next: () => {
        this.showReparationModal.set(false);
        this.success.set(this.reparationForm.cloture ? 'Panne clôturée' : 'Réparation ajoutée');
        setTimeout(() => this.success.set(''), 3000);
        this.chargerPanne(p.idPanne);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  cloturerReparation(idReparation: number) {
    const p = this.panne();
    if (!p) return;
    if (!confirm('Clôturer cette réparation ? Le véhicule repassera DISPONIBLE.')) return;

    this.http.put<Reparation>(`${this.apiUrl}/pannes/reparations/${idReparation}/cloturer`, {}).subscribe({
      next: () => {
        this.success.set('Panne clôturée — véhicule disponible');
        setTimeout(() => this.success.set(''), 3000);
        this.chargerPanne(p.idPanne);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Remplacement ──────────────────────────────────────────────────

  openRemplacementModal() {
    this.remplacementForm = {
      idTracteur: null, dateDebut: new Date().toISOString().split('T')[0],
      dateFin: '', commentaire: ''
    };
    this.error.set('');
    this.showRemplacementModal.set(true);
  }

  enregistrerRemplacement() {
    const p = this.panne();
    if (!p) return;
    if (!this.remplacementForm.idTracteur) { this.error.set('Sélectionnez un tracteur'); return; }

    const body = {
      idPanne:     p.idPanne,
      idTracteur:  this.remplacementForm.idTracteur,
      dateDebut:   this.remplacementForm.dateDebut,
      dateFin:     this.remplacementForm.dateFin || null,
      commentaire: this.remplacementForm.commentaire || null
    };

    this.http.post<Remplacement>(`${this.apiUrl}/pannes/remplacements`, body).subscribe({
      next: () => {
        this.showRemplacementModal.set(false);
        this.success.set('Remplacement enregistré');
        setTimeout(() => this.success.set(''), 3000);
        this.chargerPanne(p.idPanne);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  supprimerRemplacement(idRemplacement: number) {
    const p = this.panne();
    if (!p) return;
    if (!confirm('Supprimer ce remplacement ?')) return;

    this.http.delete(`${this.apiUrl}/pannes/remplacements/${idRemplacement}`).subscribe({
      next: () => {
        this.success.set('Remplacement supprimé');
        setTimeout(() => this.success.set(''), 3000);
        this.chargerPanne(p.idPanne);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────

  getVehiculeId(v: Vehicule): number {
    return v.idTracteur ?? v.idRemorque ?? v.idVoitureService ?? 0;
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
      EN_PANNE_IMMOBILISE: 'Immobilisé',
      EN_PANNE_AUTORISE:   'Autorisé à rouler',
      DISPONIBLE:          'Disponible'
    };
    return m[statut] || statut;
  }

  getNbJours(): number {
    const p = this.panne();
    if (!p) return 0;
    const debut = new Date(p.dateDebut);
    const fin   = new Date();
    return Math.max(0, Math.floor((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private parseErr(err: any): string {
    return err?.error?.message || err?.error || 'Une erreur est survenue';
  }


  getNbJoursOuvert(p: Panne): number {
  const debut = new Date(p.dateDebut);
  const fin = new Date();
  return Math.max(0, Math.floor((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)));
}
}