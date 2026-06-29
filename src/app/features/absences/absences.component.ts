import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

interface Absence {
  idAbsence:          number;
  idChauffeur:        number;
  nomChauffeur:       string;
  prenomChauffeur:    string;
  typeChauffeur:      string;
  dateDebut:          string;
  dateFin:            string;
  idTypeAbsence:      number;
  libelleTypeAbsence: string;
  commentaire:        string;
  usernameCreateur:   string;
}

interface TypeAbsence {
  idTypeAbsence: number;
  libelle:       string;
}

interface Chauffeur {
  idChauffeur:   number;
  nom:           string;
  prenom:        string;
  typeChauffeur: string;
  actif:         boolean;
}

@Component({
  selector: 'app-absences',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './absences.component.html',
  styleUrl: './absences.component.css'
})
export class AbsencesComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  absences     = signal<Absence[]>([]);
  typesAbsence = signal<TypeAbsence[]>([]);
  chauffeurs   = signal<Chauffeur[]>([]);

  loading   = signal(false);
  error     = signal('');
  success   = signal('');
  showModal = signal(false);
  enEdition = signal<Absence | null>(null);
  saving    = signal(false);

  filtreNom  = signal('');
  filtreType = signal('');

  form = {
    idChauffeur:   null as number | null,
    dateDebut:     '',
    dateFin:       '',
    idTypeAbsence: null as number | null,
    commentaire:   ''
  };

  absencesFiltrees = computed(() => {
    let list = this.absences();
    const nom  = this.filtreNom().toLowerCase().trim();
    const type = this.filtreType();
    if (nom)  list = list.filter(a =>
      (a.nomChauffeur + ' ' + a.prenomChauffeur).toLowerCase().includes(nom));
    if (type) list = list.filter(a => a.idTypeAbsence === Number(type));
    return list;
  });

  constructor(private http: HttpClient, public authService: AuthService) {}

  ngOnInit() { this.loadAll(); }

  // ── Chargement ────────────────────────────────────────────────────

  loadAll() {
    this.loading.set(true);
    this.http.get<Absence[]>(`${this.apiUrl}/absences`).subscribe({
      next: (d) => { this.absences.set(d); this.loading.set(false); },
      error: ()  => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
    this.http.get<TypeAbsence[]>(`${this.apiUrl}/types-absence`).subscribe({
      next: (d) => this.typesAbsence.set(d)
    });
    this.http.get<Chauffeur[]>(`${this.apiUrl}/chauffeurs`).subscribe({
      next: (d) => this.chauffeurs.set(d.filter(c => c.actif))
    });
  }

  // ── Droits ────────────────────────────────────────────────────────

  canEdit(): boolean {
    const d = this.authService.getDepartement();
    return d === 'RH' || d === 'ADMIN';
  }

  // ── Modal ─────────────────────────────────────────────────────────

  openModal(absence?: Absence) {
    this.error.set('');
    if (absence) {
      this.enEdition.set(absence);
      this.form = {
        idChauffeur:   absence.idChauffeur,
        dateDebut:     absence.dateDebut,
        dateFin:       absence.dateFin,
        idTypeAbsence: absence.idTypeAbsence,
        commentaire:   absence.commentaire || ''
      };
    } else {
      this.enEdition.set(null);
      this.form = { idChauffeur: null, dateDebut: '', dateFin: '', idTypeAbsence: null, commentaire: '' };
    }
    this.showModal.set(true);
  }

  fermerModal() { this.showModal.set(false); this.error.set(''); }

  // ── Sauvegarder ───────────────────────────────────────────────────

  sauvegarder() {
    if (!this.form.idChauffeur)   { this.error.set('Sélectionnez un chauffeur'); return; }
    if (!this.form.dateDebut || !this.form.dateFin) {
      this.error.set('Les dates sont obligatoires'); return;
    }
    if (!this.form.idTypeAbsence) { this.error.set("Sélectionnez un type d'absence"); return; }
    if (this.form.dateFin < this.form.dateDebut) {
      this.error.set('La date de fin doit être après la date de début'); return;
    }

    this.saving.set(true);
    this.error.set('');

    const body = {
      idChauffeur:   this.form.idChauffeur,
      dateDebut:     this.form.dateDebut,
      dateFin:       this.form.dateFin,
      idTypeAbsence: this.form.idTypeAbsence,
      commentaire:   this.form.commentaire || null
    };

    const abs = this.enEdition();
    const req = abs
      ? this.http.put<Absence>(`${this.apiUrl}/absences/${abs.idAbsence}`, body)
      : this.http.post<Absence>(`${this.apiUrl}/absences`, body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.success.set(abs ? 'Absence modifiée' : 'Absence enregistrée');
        setTimeout(() => this.success.set(''), 3000);
        this.loadAll();
      },
      error: (err) => { this.saving.set(false); this.error.set(this.parseErr(err)); }
    });
  }

  // ── Supprimer ─────────────────────────────────────────────────────

  supprimer(id: number) {
    if (!confirm('Supprimer cette absence ?')) return;
    this.http.delete(`${this.apiUrl}/absences/${id}`).subscribe({
      next: () => {
        this.success.set('Absence supprimée');
        setTimeout(() => this.success.set(''), 3000);
        this.loadAll();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────

  getTypeLabel(libelle: string): string {
    const m: Record<string, string> = {
      CONGE_ANNUEL:  'Congé annuel',   CONGE_MALADIE: 'Congé maladie',
      SUSPENSION:    'Suspension',     FORMATION:     'Formation',
      AUTRE:         'Autre'
    };
    return m[libelle] || libelle;
  }

  getTypeClass(libelle: string): string {
    const m: Record<string, string> = {
      CONGE_ANNUEL:  'badge-conge',   CONGE_MALADIE: 'badge-maladie',
      SUSPENSION:    'badge-suspension', FORMATION:   'badge-formation',
      AUTRE:         'badge-autre'
    };
    return m[libelle] || 'badge-autre';
  }

  isAbsenceActive(a: Absence): boolean {
    const today = new Date().toISOString().split('T')[0];
    return a.dateDebut <= today && a.dateFin >= today;
  }

  isAbsenceAVenir(a: Absence): boolean {
    return a.dateDebut > new Date().toISOString().split('T')[0];
  }

  getStatutAbsence(a: Absence): string {
    if (this.isAbsenceActive(a)) return 'EN COURS';
    if (this.isAbsenceAVenir(a)) return 'À VENIR';
    return 'TERMINÉE';
  }

  getStatutClass(a: Absence): string {
    if (this.isAbsenceActive(a)) return 'statut-encours';
    if (this.isAbsenceAVenir(a)) return 'statut-avenir';
    return 'statut-termine';
  }

  getNbJours(a: Absence): number {
    const diff = new Date(a.dateFin).getTime() - new Date(a.dateDebut).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  get nbEnCours(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateDebut <= today && a.dateFin >= today).length;
  }

  get nbAVenir(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateDebut > today).length;
  }

  get nbTerminees(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateFin < today).length;
  }

  getNbJoursForm(): number {
    if (!this.form.dateDebut || !this.form.dateFin || this.form.dateFin < this.form.dateDebut) return 0;
    const diff = new Date(this.form.dateFin).getTime() - new Date(this.form.dateDebut).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  private parseErr(err: any): string {
    return err?.error?.message || err?.error || 'Une erreur est survenue';
  }
}