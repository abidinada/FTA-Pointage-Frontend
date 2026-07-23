import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-remorques',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './remorques.component.html',
  styleUrl: './remorques.component.css',
})
export class RemorquesComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api/remorques';

  remorques = signal<any[]>([]);
  typesRemorque = signal<any[]>([]);
  statuts = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  success = signal('');

  recherche = '';
  filtreStatut = '';

  showModal = signal(false);
  showStatutModal = signal(false);

  form = { immatriculation: '', idTypeRemorque: '', idStatutVehicule: '' };
  selectedId = signal<number | null>(null);
  nouveauStatutId = '';

  // FIX : les statuts de panne (EN_PANNE_AUTORISE / EN_PANNE_IMMOBILISE) ne
  // doivent jamais être choisis manuellement depuis cette page — ils sont
  // exclusivement gérés par le module Pannes (RG-PA03/RG-PA04). Le backend
  // les refuse désormais aussi (défense en profondeur), mais on évite déjà
  // de les proposer côté UI pour ne pas laisser cliquer sur une option qui
  // échouera systématiquement.
  private readonly STATUTS_PANNE = ['EN_PANNE_AUTORISE', 'EN_PANNE_IMMOBILISE'];

  statutsDisponibles = computed(() =>
    this.statuts().filter(s => !this.STATUTS_PANNE.includes(s.libelle))
  );

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadRemorques();
    this.loadTypes();
    this.loadStatuts();
  }

  loadRemorques() {
    this.loading.set(true);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => { this.remorques.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  loadTypes() {
    this.http.get<any[]>('http://localhost:8080/api/types-remorque').subscribe({
      next: (data) => this.typesRemorque.set(data)
    });
  }

  loadStatuts() {
    this.http.get<any[]>('http://localhost:8080/api/statuts-vehicule').subscribe({
      next: (data) => this.statuts.set(data)
    });
  }

  get remorquesFiltres() {
    return this.remorques().filter(r => {
      const matchRecherche = !this.recherche ||
        r.immatriculation.toLowerCase().includes(this.recherche.toLowerCase());
      const matchStatut = !this.filtreStatut || r.statutVehicule?.libelle === this.filtreStatut;
      return matchRecherche && matchStatut;
    });
  }

  isAdmin() { return this.authService.getDepartement() === 'ADMIN'; }

  canChangeStatut() {
    const dept = this.authService.getDepartement();
    return dept === 'ADMIN' || dept === 'MAINTENANCE';
  }

  openAjouter() {
    this.form = { immatriculation: '', idTypeRemorque: '', idStatutVehicule: '' };
    this.showModal.set(true);
  }

  openChangerStatut(r: any) {
    this.selectedId.set(r.idRemorque);
    this.nouveauStatutId = '';
    this.error.set('');
    this.showStatutModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.showStatutModal.set(false);
    this.error.set('');
  }

  sauvegarder() {
    if (!this.form.immatriculation || !this.form.idTypeRemorque || !this.form.idStatutVehicule) {
      this.error.set('Tous les champs sont obligatoires');
      return;
    }
    this.http.post(this.apiUrl, {
      immatriculation: this.form.immatriculation,
      idTypeRemorque: +this.form.idTypeRemorque,
      idStatutVehicule: +this.form.idStatutVehicule
    }).subscribe({
      next: () => {
        this.success.set('Remorque ajoutée avec succès');
        this.closeModal();
        this.loadRemorques();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  changerStatut() {
    if (!this.nouveauStatutId) {
      this.error.set('Choisissez un statut');
      return;
    }
    this.http.put(
      `${this.apiUrl}/${this.selectedId()}/statut?idStatut=${this.nouveauStatutId}`,
      {},
      { responseType: 'text' }
    ).subscribe({
      next: () => {
        this.success.set('Statut mis à jour');
        this.closeModal();
        this.loadRemorques();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  getStatutClass(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return 'disponible';
      case 'EN_PANNE_AUTORISE': return 'panne-autorise';
      case 'EN_PANNE_IMMOBILISE': return 'panne-immobilise';
      case 'HORS_SERVICE': return 'hors-service';
      default: return '';
    }
  }

  private parseErr(err: any): string {
    return err?.error?.message || err?.error || 'Une erreur est survenue';
  }
}