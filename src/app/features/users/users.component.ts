import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api/users';

  users = signal<any[]>([]);
  departements = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  success = signal('');

  recherche = '';
  filtreActif: boolean | null = null;

  showModal = signal(false);
  showDesactiverModal = signal(false);
  showPasswordModal = signal(false);

  form = { username: '', password: '', idDepartement: '' };
  selectedId = signal<number | null>(null);
  motifDesactivation = '';
  nouveauPassword = '';

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadDepartements();
  }

  loadUsers() {
    this.loading.set(true);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => { this.users.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  loadDepartements() {
    this.http.get<any[]>('http://localhost:8080/api/departements').subscribe({
      next: (data) => this.departements.set(data)
    });
  }

  get usersFiltres() {
    return this.users().filter(u => {
      const matchRecherche = !this.recherche ||
        u.username.toLowerCase().includes(this.recherche.toLowerCase()) ||
        u.departement.toLowerCase().includes(this.recherche.toLowerCase());
      const matchActif = this.filtreActif === null || u.actif === this.filtreActif;
      return matchRecherche && matchActif;
    });
  }

  openAjouter() {
    this.form = { username: '', password: '', idDepartement: '' };
    this.showModal.set(true);
  }

  openDesactiver(u: any) {
    this.selectedId.set(u.idUser);
    this.motifDesactivation = '';
    this.showDesactiverModal.set(true);
  }

  openPassword(u: any) {
    this.selectedId.set(u.idUser);
    this.nouveauPassword = '';
    this.showPasswordModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.showDesactiverModal.set(false);
    this.showPasswordModal.set(false);
    this.error.set('');
  }

  sauvegarder() {
    if (!this.form.username || !this.form.password || !this.form.idDepartement) {
      this.error.set('Tous les champs sont obligatoires');
      return;
    }
    this.http.post(this.apiUrl, {
      username: this.form.username,
      password: this.form.password,
      idDepartement: +this.form.idDepartement
    }).subscribe({
      next: () => {
        this.success.set('Utilisateur créé avec succès');
        this.closeModal();
        this.loadUsers();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erreur lors de la création')
    });
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
        this.success.set('Utilisateur désactivé');
        this.closeModal();
        this.loadUsers();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erreur lors de la désactivation')
    });
  }

  reactiver(u: any) {
    this.http.put(`${this.apiUrl}/${u.idUser}/reactiver`, {},
      { responseType: 'text' }
    ).subscribe({
      next: () => {
        this.success.set('Utilisateur réactivé');
        this.loadUsers();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erreur lors de la réactivation')
    });
  }

  reinitialiserPassword() {
    if (!this.nouveauPassword) {
      this.error.set('Le mot de passe est obligatoire');
      return;
    }
    this.http.put(`${this.apiUrl}/${this.selectedId()}/reinitialiser-password`,
      { newPassword: this.nouveauPassword }
    ).subscribe({
      next: () => {
        this.success.set('Mot de passe réinitialisé');
        this.closeModal();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erreur lors de la réinitialisation')
    });
  }
}