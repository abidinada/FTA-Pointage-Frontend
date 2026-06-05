import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule, MatIconModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {

  private apiUrl = 'http://localhost:8080/api';
  private intervalId: any;

  notifCount = signal<number>(0);

  constructor(
    private router: Router,
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.loadCompteur();
      // Rafraîchir toutes les 30 secondes
      this.intervalId = setInterval(() => this.loadCompteur(), 30000);
    }
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private loadCompteur() {
    this.http.get<number>(`${this.apiUrl}/notifications/compteur`).subscribe({
      next: (count) => this.notifCount.set(count),
      error: () => {}  // silencieux
    });
  }

  logout() {
    this.notifCount.set(0);
    if (this.intervalId) clearInterval(this.intervalId);
    this.authService.logout();
    this.router.navigate(['/']);
  }
}