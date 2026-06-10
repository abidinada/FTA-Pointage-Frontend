import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-marques',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marques.component.html',
  styleUrl: './marques.component.css',
})
export class MarquesComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api/marques';

  marques  = signal<any[]>([]);
  loading  = signal(false);
  error    = signal('');
  success  = signal('');

  showModal = signal(false);
  isEditing = signal(false);
  selectedId = signal<number | null>(null);

  form = { libelle: '' };

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (d) => { this.marques.set(d); this.loading.set(false); },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  isAdmin(): boolean {
    return this.authService.getDepartement() === 'ADMIN';
  }

  openAjouter() {
    this.isEditing.set(false);
    this.form = { libelle: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  openModifier(m: any) {
    this.isEditing.set(true);
    this.selectedId.set(m.idMarque);
    this.form = { libelle: m.libelle };
    this.error.set('');
    this.showModal.set(true);
  }

  sauvegarder() {
    if (!this.form.libelle.trim()) {
      this.error.set('Le libellé est obligatoire');
      return;
    }

    const body = { libelle: this.form.libelle.trim() };

    if (this.isEditing()) {
      this.http.put(`${this.apiUrl}/${this.selectedId()}`, body).subscribe({
        next: () => {
          this.success.set('Marque modifiée');
          this.closeModal();
          this.load();
          setTimeout(() => this.success.set(''), 3000);
        },
        error: (err) => this.error.set(err.error || 'Erreur modification')
      });
    } else {
      this.http.post(this.apiUrl, body).subscribe({
        next: () => {
          this.success.set('Marque ajoutée');
          this.closeModal();
          this.load();
          setTimeout(() => this.success.set(''), 3000);
        },
        error: (err) => this.error.set(err.error || 'Erreur création')
      });
    }
  }

  supprimer(m: any) {
    if (!confirm(`Supprimer la marque "${m.libelle}" ?`)) return;
    this.http.delete(`${this.apiUrl}/${m.idMarque}`).subscribe({
      next: () => {
        this.success.set('Marque supprimée');
        this.load();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(err.error || 'Impossible — marque utilisée par des véhicules')
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.error.set('');
  }
}