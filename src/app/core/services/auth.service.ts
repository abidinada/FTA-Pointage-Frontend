import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private apiUrl = 'http://localhost:8080/api';

  // Infos utilisateur connecté
  currentUser = signal<LoginResponse | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    // Recharge l'utilisateur depuis localStorage au démarrage
    const stored = localStorage.getItem('user');
    if (stored) this.currentUser.set(JSON.parse(stored));
  }

  login(request: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, request);
  }

  saveSession(response: LoginResponse) {
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response));
    this.currentUser.set(response);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getDepartement(): string {
    return this.currentUser()?.departement ?? '';
  }
}