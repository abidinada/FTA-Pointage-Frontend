import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './rapports.component.html',
  styleUrl: './rapports.component.css'
})
export class RapportsComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  rapports = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  success = signal('');

  // Onglets
  ongletActif = signal<'tous' | 'traiter' | 'archives'>('traiter');

  // Modal créer rapport
  showModal = signal(false);
  newDateRapport = '';
  today = new Date().toISOString().split('T')[0];

  constructor(
    private http: HttpClient,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadRapports();
    // Onglet par défaut selon département
    const dept = this.authService.getDepartement();
    if (dept === 'RH') {
      this.ongletActif.set('archives');
    } else {
      this.ongletActif.set('traiter');
    }
  }

  loadRapports() {
    this.loading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/rapports`).subscribe({
      next: (data) => { this.rapports.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  // ── Filtrage ──────────────────────────────────────────────────────

get rapportsFiltres(): any[] {
  const onglet = this.ongletActif();
  const tous = this.rapports();
  const dept = this.authService.getDepartement();

  if (onglet === 'archives') {
    return tous.filter(r => r.statutRapport === 'TRANSMIS_RH');
  }

  if (onglet === 'traiter') {
    // Filtrage selon département
    if (dept === 'QUALITE') {
      return tous.filter(r => r.statutRapport === 'TRANSMIS_QUALITE');
    }
    if (dept === 'EXPLOITATION_NATIONALE' || dept === 'EXPLOITATION_INTERNATIONALE') {
      return tous.filter(r => ['BROUILLON', 'RETOURNE'].includes(r.statutRapport));
    }
    if (dept === 'RH') {
      return tous.filter(r => r.statutRapport === 'TRANSMIS_RH');
    }
    if (dept === 'RESPONSABLE_EXPLOITATION') {
      return tous.filter(r => 
      ['BROUILLON', 'TRANSMIS_QUALITE', 'RETOURNE'].includes(r.statutRapport)
      );
    }
    // ADMIN voit tout
    return tous.filter(r => ['BROUILLON', 'SOUMIS', 'RETOURNE'].includes(r.statutRapport));
  }

  return tous; // onglet Tous
}

  get countTraiter(): number {
  const dept = this.authService.getDepartement();
  const tous = this.rapports();
  if (dept === 'QUALITE')
    return tous.filter(r => r.statutRapport === 'TRANSMIS_QUALITE').length;
  if (dept === 'EXPLOITATION_NATIONALE' || dept === 'EXPLOITATION_INTERNATIONALE')
    return tous.filter(r => ['BROUILLON', 'RETOURNE'].includes(r.statutRapport)).length;
  if (dept === 'RH')
    return tous.filter(r => r.statutRapport === 'TRANSMIS_RH').length;
  return tous.filter(r => ['BROUILLON', 'TRANSMIS_QUALITE', 'RETOURNE'].includes(r.statutRapport)).length;
}

  get countArchives(): number {
    return this.rapports().filter(r => r.statutRapport === 'TRANSMIS_RH').length;
  }

  // ── Droits ────────────────────────────────────────────────────────

  isExploitation(): boolean {
    const d = this.authService.getDepartement();
    return d === 'EXPLOITATION_NATIONALE' || d === 'EXPLOITATION_INTERNATIONALE';
  }

  // ── Actions ───────────────────────────────────────────────────────

  openCreer() {
    this.newDateRapport = '';
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.error.set('');
  }

  creerRapport() {
    if (!this.newDateRapport) { this.error.set('La date est obligatoire'); return; }
    this.http.post<any>(`${this.apiUrl}/rapports`, {
      dateRapport: this.newDateRapport
    }).subscribe({
      next: (rapport) => {
        this.success.set('Rapport créé');
        this.closeModal();
        setTimeout(() => this.success.set(''), 3000);
        this.router.navigate(['/rapports', rapport.idRapport]);
      },
      error: (err) => this.error.set(err.error || 'Erreur — ce rapport existe peut-être déjà')
    });
  }

  ouvrirRapport(rapport: any) {
  const dept = this.authService.getDepartement();
  if (dept === 'RESPONSABLE_EXPLOITATION') {
    this.router.navigate(['/responsable/rapport', rapport.idRapport]);
  } else {
    this.router.navigate(['/rapports', rapport.idRapport]);
  }
}

  // ── Helpers ───────────────────────────────────────────────────────

  getBadgeClass(statut: string): string {
  switch (statut) {
    case 'BROUILLON':        return 'badge-brouillon';
    case 'SOUMIS':           return 'badge-soumis';
    case 'RETOURNE':         return 'badge-retourne';
    case 'TRANSMIS_RH':      return 'badge-transmis';
    case 'TRANSMIS_QUALITE': return 'badge-qualite';
    default:                 return 'badge-default';
  }
}

  getStatutLabel(statut: string): string {
  switch (statut) {
    case 'BROUILLON':        return 'Brouillon';
    case 'SOUMIS':           return 'Soumis';
    case 'RETOURNE':         return 'Retourné';
    case 'TRANSMIS_RH':      return 'Transmis RH';
    case 'TRANSMIS_QUALITE': return 'Transmis Qualité';
    default:                 return statut;
  }
}

  getStatutIcon(statut: string): string {
    switch (statut) {
      case 'BROUILLON':   return 'edit_note';
      case 'SOUMIS':      return 'pending';
      case 'RETOURNE':    return 'reply';
      case 'TRANSMIS_RH': return 'check_circle';
      case 'TRANSMIS_QUALITE': return 'verified';
      default:            return 'circle';
    }
  }


}