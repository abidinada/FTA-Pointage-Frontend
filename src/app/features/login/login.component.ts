import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class Login {
  username = signal('');
  password = signal('');
  loading  = signal(false);
  error    = signal('');

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  login() {
    if (!this.username() || !this.password()) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.login({
      username: this.username(),
      password: this.password()
    }).subscribe({
      next: (response) => {
        this.authService.saveSession(response);
        this.loading.set(false);
        // Redirige selon le département
        this.redirectByDepartement(response.departement);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Identifiants incorrects ou compte désactivé');
      }
    });
  }

  private redirectByDepartement(departement: string) {
    switch (departement) {
      case 'EXPLOITATION_NATIONALE':
      case 'EXPLOITATION_INTERNATIONALE':
        this.router.navigate(['/dashboard']);
        break;
      case 'QUALITE':
        this.router.navigate(['/dashboard']);
        break;
      case 'RH':
        this.router.navigate(['/dashboard']);
        break;
      case 'ADMIN':
        this.router.navigate(['/dashboard']);
        break;
      default:
        this.router.navigate(['/dashboard']);
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}