import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chauffeurs.component.html',
  styleUrl: './chauffeurs.component.css',
})
export class ChauffeursComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api/chauffeurs';

  chauffeurs = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  success = signal('');

  // Filtres
  filtreActif: boolean | null = null;
  filtreType: string = '';
  recherche: string = '';

  // Modal
  showModal = signal(false);
  showDesactiverModal = signal(false);
  isEditing = signal(false);

  // Formulaire
  form = {
    nom: '',
    prenom: '',
    typeChauffeur: 'NATIONAL',
    dateEmbauche: '',
    dateExpirationVisa: ''
  };

  selectedId = signal<number | null>(null);
  motifDesactivation = '';

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadChauffeurs();
  }

  loadChauffeurs() {
    this.loading.set(true);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.chauffeurs.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des chauffeurs');
        this.loading.set(false);
      }
    });
  }

  get chauffeursFiltres() {
    return this.chauffeurs().filter(c => {
      const matchActif = this.filtreActif === null || c.actif === this.filtreActif;
      const matchType = !this.filtreType || c.typeChauffeur === this.filtreType;
      const matchRecherche = !this.recherche ||
        c.nom.toLowerCase().includes(this.recherche.toLowerCase()) ||
        c.prenom.toLowerCase().includes(this.recherche.toLowerCase());
      return matchActif && matchType && matchRecherche;
    });
  }

  isAdmin() {
    return this.authService.getDepartement() === 'ADMIN';
  }

  openAjouter() {
    this.isEditing.set(false);
    this.form = {
      nom: '', prenom: '',
      typeChauffeur: 'NATIONAL',
      dateEmbauche: '', dateExpirationVisa: ''
    };
    this.showModal.set(true);
  }

  openModifier(c: any) {
    this.isEditing.set(true);
    this.selectedId.set(c.idChauffeur);
    this.form = {
      nom: c.nom,
      prenom: c.prenom,
      typeChauffeur: c.typeChauffeur,
      dateEmbauche: c.dateEmbauche ?? '',
      dateExpirationVisa: c.dateExpirationVisa ?? ''
    };
    this.showModal.set(true);
  }

  openDesactiver(c: any) {
    this.selectedId.set(c.idChauffeur);
    this.motifDesactivation = '';
    this.showDesactiverModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.showDesactiverModal.set(false);
    this.error.set('');
  }

  sauvegarder() {
    if (!this.form.nom || !this.form.prenom) {
      this.error.set('Nom et prénom sont obligatoires');
      return;
    }

    const body: any = {
      nom: this.form.nom,
      prenom: this.form.prenom,
      typeChauffeur: this.form.typeChauffeur,
      dateEmbauche: this.form.dateEmbauche || null,
      dateExpirationVisa: this.form.dateExpirationVisa || null
    };

    if (this.isEditing()) {
      this.http.put(`${this.apiUrl}/${this.selectedId()}`, body).subscribe({
        next: () => {
          this.success.set('Chauffeur modifié avec succès');
          this.closeModal();
          this.loadChauffeurs();
          setTimeout(() => this.success.set(''), 3000);
        },
        error: () => this.error.set('Erreur lors de la modification')
      });
    } else {
      this.http.post(this.apiUrl, body).subscribe({
        next: () => {
          this.success.set('Chauffeur ajouté avec succès');
          this.closeModal();
          this.loadChauffeurs();
          setTimeout(() => this.success.set(''), 3000);
        },
        error: () => this.error.set('Erreur lors de la création')
      });
    }
  }

desactiver() {
  if (!this.motifDesactivation) {
    this.error.set('Le motif est obligatoire');
    return;
  }
  this.http.put(`${this.apiUrl}/${this.selectedId()}/desactiver`,
    { motif: this.motifDesactivation },
    { responseType: 'text' }   // ← ajoute ça
  ).subscribe({
    next: () => {
      this.success.set('Chauffeur désactivé');
      this.closeModal();
      this.loadChauffeurs();
      setTimeout(() => this.success.set(''), 3000);
    },
    error: () => this.error.set('Erreur lors de la désactivation')
  });
}
reactiver(c: any) {
  this.http.put(`${this.apiUrl}/${c.idChauffeur}/reactiver`, {},
    { responseType: 'text' }
  ).subscribe({
    next: () => {
      this.success.set('Chauffeur réactivé avec succès');
      this.loadChauffeurs();
      setTimeout(() => this.success.set(''), 3000);
    },
    error: () => this.error.set('Erreur lors de la réactivation')
  });
}
}