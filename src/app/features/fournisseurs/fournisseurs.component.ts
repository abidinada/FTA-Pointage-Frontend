import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-fournisseurs',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './fournisseurs.component.html',
  styleUrl: './fournisseurs.component.css',
})
export class FournisseursComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api/fournisseurs';

  fournisseurs = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  success = signal('');

  recherche = '';
  showModal = signal(false);
  showDeleteModal = signal(false);
  isEditing = signal(false);

  form = { nomSociete: '', contact: '' };
  selectedId = signal<number | null>(null);

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() { this.loadFournisseurs(); }

  loadFournisseurs() {
    this.loading.set(true);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => { this.fournisseurs.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  get fournisseursFiltres() {
    return this.fournisseurs().filter(f =>
      !this.recherche ||
      f.nomSociete.toLowerCase().includes(this.recherche.toLowerCase())
    );
  }

  isAdmin() { return this.authService.getDepartement() === 'ADMIN'; }

  openAjouter() {
    this.isEditing.set(false);
    this.form = { nomSociete: '', contact: '' };
    this.showModal.set(true);
  }

  openModifier(f: any) {
    this.isEditing.set(true);
    this.selectedId.set(f.idFournisseur);
    this.form = { nomSociete: f.nomSociete, contact: f.contact ?? '' };
    this.showModal.set(true);
  }

  openSupprimer(f: any) {
    this.selectedId.set(f.idFournisseur);
    this.showDeleteModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.showDeleteModal.set(false);
    this.error.set('');
  }

  sauvegarder() {
    if (!this.form.nomSociete) {
      this.error.set('Le nom de la société est obligatoire');
      return;
    }
    const request = this.isEditing()
      ? this.http.put(`${this.apiUrl}/${this.selectedId()}`, this.form)
      : this.http.post(this.apiUrl, this.form);

    request.subscribe({
      next: () => {
        this.success.set(this.isEditing() ? 'Fournisseur modifié' : 'Fournisseur ajouté');
        this.closeModal();
        this.loadFournisseurs();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erreur lors de la sauvegarde')
    });
  }

  supprimer() {
    this.http.delete(`${this.apiUrl}/${this.selectedId()}`,
      { responseType: 'text' }
    ).subscribe({
      next: () => {
        this.success.set('Fournisseur supprimé');
        this.closeModal();
        this.loadFournisseurs();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erreur lors de la suppression')
    });
  }
}