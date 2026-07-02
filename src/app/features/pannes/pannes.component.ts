import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
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

interface Vehicule {
  idTracteur?: number;
  idRemorque?: number;
  idVoitureService?: number;
  immatriculation: string;
  statutVehicule: { libelle: string } | string;
}

interface Atelier {
  idAtelier: number;
  nom: string;
  adresse: string;
  type: string;
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
  ateliers    = signal<Atelier[]>([]);

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

  showDetailModal = signal(false);
  panneDetail     = signal<Panne | null>(null);

  showReparationModal = signal(false);
  reparationForm = {
    idAtelier:           null as number | null,
    dateReparation:       new Date().toISOString().split('T')[0],
    descriptionTravaux:   '',
    technicien:           '',
    cloture:              false
  };

  showRemplacementModal = signal(false);
  remplacementForm = {
    idTracteur:  null as number | null,
    dateDebut:   new Date().toISOString().split('T')[0],
    dateFin:     '',
    commentaire: ''
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

  tracteursDisponibles = computed(() =>
    this.tracteurs().filter(t => this.getStatutLibelle(t) === 'DISPONIBLE')
  );

  constructor(private http: HttpClient, public authService: AuthService) {}

  ngOnInit() {
    this.charger();
    this.chargerVehicules();
    this.chargerAteliers();
  }

  charger() {
    this.loading.set(true);
    this.http.get<Panne[]>(`${this.apiUrl}/pannes`).subscribe({
      next: (d) => { this.pannes.set(d); this.loading.set(false); },
      error: ()  => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  chargerVehicules() {
    this.http.get<Vehicule[]>(`${this.apiUrl}/tracteurs`).subscribe({ next: (d) => this.tracteurs.set(d) });
    this.http.get<Vehicule[]>(`${this.apiUrl}/remorques`).subscribe({ next: (d) => this.remorques.set(d) });
    this.http.get<Vehicule[]>(`${this.apiUrl}/voitures-service`).subscribe({ next: (d) => this.voitures.set(d) });
  }

  chargerAteliers() {
    this.http.get<Atelier[]>(`${this.apiUrl}/ateliers`).subscribe({ next: (d) => this.ateliers.set(d) });
  }

  isMaintenance(): boolean { return this.authService.getDepartement() === 'MAINTENANCE'; }
  canEdit():       boolean { return this.isMaintenance(); }

  getVehiculesPourType(type: string): Vehicule[] {
    if (type === 'TRACTEUR') return this.tracteurs();
    if (type === 'REMORQUE') return this.remorques();
    return this.voitures();
  }

  getStatutLibelle(v: Vehicule): string {
    if (typeof v.statutVehicule === 'string') return v.statutVehicule;
    return v.statutVehicule?.libelle || '';
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
    this.http.get<Panne>(`${this.apiUrl}/pannes/${p.idPanne}`).subscribe({
      next: (d) => { this.panneDetail.set(d); this.showDetailModal.set(true); },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  changerStatutVehicule(nouveauStatut: string) {
    const p = this.panneDetail();
    if (!p) return;
    this.http.put<Panne>(`${this.apiUrl}/pannes/${p.idPanne}/statut`, { statut: nouveauStatut }).subscribe({
      next: () => {
        this.success.set('Statut mis à jour');
        setTimeout(() => this.success.set(''), 3000);
        this.ouvrirDetail(p);
        this.charger();
        this.chargerVehicules();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  openReparationModal() {
    this.reparationForm = {
      idAtelier: null, dateReparation: new Date().toISOString().split('T')[0],
      descriptionTravaux: '', technicien: '', cloture: false
    };
    this.error.set('');
    this.showReparationModal.set(true);
  }

  ajouterReparation() {
    const p = this.panneDetail();
    if (!p) return;
    if (!this.reparationForm.idAtelier) { this.error.set('Sélectionnez un atelier'); return; }

    const body = {
      idPanne: p.idPanne,
      idAtelier: this.reparationForm.idAtelier,
      dateReparation: this.reparationForm.dateReparation,
      descriptionTravaux: this.reparationForm.descriptionTravaux || null,
      technicien: this.reparationForm.technicien || null,
      cloture: this.reparationForm.cloture
    };

    this.http.post<Reparation>(`${this.apiUrl}/pannes/reparations`, body).subscribe({
      next: () => {
        this.showReparationModal.set(false);
        this.success.set(this.reparationForm.cloture ? 'Panne clôturée' : 'Réparation ajoutée');
        setTimeout(() => this.success.set(''), 3000);
        this.ouvrirDetail(p);
        this.charger();
        this.chargerVehicules();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  cloturerReparation(idReparation: number) {
    const p = this.panneDetail();
    if (!p) return;
    if (!confirm('Clôturer cette réparation ? Le véhicule repassera DISPONIBLE.')) return;

    this.http.put<Reparation>(`${this.apiUrl}/pannes/reparations/${idReparation}/cloturer`, {}).subscribe({
      next: () => {
        this.success.set('Panne clôturée — véhicule disponible');
        setTimeout(() => this.success.set(''), 3000);
        this.ouvrirDetail(p);
        this.charger();
        this.chargerVehicules();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  openRemplacementModal() {
    this.remplacementForm = {
      idTracteur: null, dateDebut: new Date().toISOString().split('T')[0],
      dateFin: '', commentaire: ''
    };
    this.error.set('');
    this.showRemplacementModal.set(true);
  }

  enregistrerRemplacement() {
    const p = this.panneDetail();
    if (!p) return;
    if (!this.remplacementForm.idTracteur) { this.error.set('Sélectionnez un tracteur'); return; }

    const body = {
      idPanne: p.idPanne,
      idTracteur: this.remplacementForm.idTracteur,
      dateDebut: this.remplacementForm.dateDebut,
      dateFin: this.remplacementForm.dateFin || null,
      commentaire: this.remplacementForm.commentaire || null
    };

    this.http.post<Remplacement>(`${this.apiUrl}/pannes/remplacements`, body).subscribe({
      next: () => {
        this.showRemplacementModal.set(false);
        this.success.set('Remplacement enregistré');
        setTimeout(() => this.success.set(''), 3000);
        this.ouvrirDetail(p);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  supprimerRemplacement(idRemplacement: number) {
    const p = this.panneDetail();
    if (!p) return;
    if (!confirm('Supprimer ce remplacement ?')) return;

    this.http.delete(`${this.apiUrl}/pannes/remplacements/${idRemplacement}`).subscribe({
      next: () => { this.success.set('Remplacement supprimé'); this.ouvrirDetail(p); },
      error: (err) => this.error.set(this.parseErr(err))
    });
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