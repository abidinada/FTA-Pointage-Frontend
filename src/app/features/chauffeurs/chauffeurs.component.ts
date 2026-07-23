import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-chauffeurs',
  standalone: true,
  imports: [CommonModule, FormsModule,MatIconModule],
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

  // FIX : filtre "alerte visa" activé depuis le dashboard via
  // /chauffeurs?visaAlerte=true — même fenêtre que le dashboard (40j,
  // visa expiré, ou visa manquant pour un chauffeur INTERNATIONAL).
  filtreVisaAlerte = signal(false);

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
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // FIX : lit le query param posé par le dashboard pour activer le filtre
    // automatiquement à l'arrivée sur la page.
    this.route.queryParams.subscribe(params => {
      this.filtreVisaAlerte.set(params['visaAlerte'] === 'true');
    });
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

  // FIX : même logique de fenêtre que dashboard.component.ts (40j,
  // international uniquement, visa manquant ou déjà expiré inclus).
  private estEnAlerteVisa(c: any): boolean {
    if (c.typeChauffeur !== 'INTERNATIONAL') return false;
    if (!c.dateExpirationVisa) return true;
    const today = new Date();
    const in40days = new Date();
    in40days.setDate(today.getDate() + 40);
    return new Date(c.dateExpirationVisa) <= in40days;
  }

  get chauffeursFiltres() {
    return this.chauffeurs().filter(c => {
      const matchActif = this.filtreActif === null || c.actif === this.filtreActif;
      const matchType = !this.filtreType || c.typeChauffeur === this.filtreType;
      const matchRecherche = !this.recherche ||
        c.nom.toLowerCase().includes(this.recherche.toLowerCase()) ||
        c.prenom.toLowerCase().includes(this.recherche.toLowerCase());
      const matchVisaAlerte = !this.filtreVisaAlerte() || this.estEnAlerteVisa(c);
      return matchActif && matchType && matchRecherche && matchVisaAlerte;
    });
  }

  // FIX : permet de retirer le filtre "alerte visa" sans recharger la page,
  // en nettoyant aussi le query param dans l'URL.
  retirerFiltreVisaAlerte() {
    this.filtreVisaAlerte.set(false);
    this.router.navigate([], { queryParams: {} });
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
      { responseType: 'text' }
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