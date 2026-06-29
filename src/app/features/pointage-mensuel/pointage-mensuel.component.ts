import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

interface JourneeTravail {
  idJourneeTravail: number;
  dateJournee:      string;
  valeurJournee:    number;
  origine:          string;
  codeAffichage:    string;
}

interface PointageLigne {
  idPointageMensuel:            number;
  idChauffeur:                  number;
  nomChauffeur:                 string;
  prenomChauffeur:               string;
  typeChauffeur:                string;
  dateEmbauche:                 string | null;
  mois:                         number;
  annee:                        number;
  totalJoursTravailles:         number;
  totalMissionsNationales:      number;
  totalMissionsInternationales: number;
  statutPointage:               string;
  journees:                     JourneeTravail[];
}

@Component({
  selector: 'app-pointage-mensuel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './pointage-mensuel.component.html',
  styleUrl: './pointage-mensuel.component.css'
})
export class PointageMensuelComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  exportingExcel = signal(false);
  pointages   = signal<PointageLigne[]>([]);
  loading     = signal(false);
  generating  = signal(false);
  error       = signal('');
  success     = signal('');

  filtreMois  = signal(new Date().getMonth() + 1);
  filtreAnnee = signal(new Date().getFullYear());
  filtreNom   = signal('');

  showCorrModal  = signal(false);
  corrChauffeur  = signal<PointageLigne | null>(null);
  corrJournee    = signal<JourneeTravail | null>(null);
  corrValeur     = '1.00';
  corrCode       = '';

  annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  moisList = [
    { val: 1, label: 'Janvier' },   { val: 2,  label: 'Février' },
    { val: 3, label: 'Mars' },      { val: 4,  label: 'Avril' },
    { val: 5, label: 'Mai' },       { val: 6,  label: 'Juin' },
    { val: 7, label: 'Juillet' },   { val: 8,  label: 'Août' },
    { val: 9, label: 'Septembre' }, { val: 10, label: 'Octobre' },
    { val: 11, label: 'Novembre' }, { val: 12, label: 'Décembre' }
  ];

  joursDuMois = computed(() => {
    const m = this.filtreMois();
    const a = this.filtreAnnee();
    const nbJours = new Date(a, m, 0).getDate();
    return Array.from({ length: nbJours }, (_, i) => i + 1);
  });

  pointagesFiltres = computed(() => {
    const nom = this.filtreNom().toLowerCase().trim();
    if (!nom) return this.pointages();
    return this.pointages().filter(p =>
      (p.nomChauffeur + ' ' + p.prenomChauffeur).toLowerCase().includes(nom));
  });

  estMoisEnCours = computed(() => {
    const now = new Date();
    return this.filtreMois() === now.getMonth() + 1 &&
           this.filtreAnnee() === now.getFullYear();
  });

  constructor(private http: HttpClient, public authService: AuthService) {}

  ngOnInit() { this.charger(); }

  // ── Chargement ────────────────────────────────────────────────────

  charger() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<PointageLigne[]>(
      `${this.apiUrl}/pointage/calendrier?mois=${this.filtreMois()}&annee=${this.filtreAnnee()}`
    ).subscribe({
      next: (d) => { this.pointages.set(d); this.loading.set(false); },
      error: ()  => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  changerMois(delta: number) {
    let m = this.filtreMois() + delta;
    let a = this.filtreAnnee();
    if (m > 12) { m = 1; a++; }
    if (m < 1)  { m = 12; a--; }
    this.filtreMois.set(m);
    this.filtreAnnee.set(a);
    this.charger();
  }

  // ── Générer ───────────────────────────────────────────────────────

  generer() {
    const label = this.estMoisEnCours()
      ? `Générer le pointage jusqu'à hier pour ${this.getMoisLabel(this.filtreMois())} ${this.filtreAnnee()} ?`
      : `Générer le pointage complet de ${this.getMoisLabel(this.filtreMois())} ${this.filtreAnnee()} ?`;
    if (!confirm(label)) return;

    this.generating.set(true);
    this.error.set('');
    this.http.post<any[]>(`${this.apiUrl}/pointage/generer`, {
      mois: this.filtreMois(), annee: this.filtreAnnee()
    }).subscribe({
      next: (d) => {
        this.generating.set(false);
        this.success.set(`Pointage généré — ${d.length} chauffeur(s)`);
        setTimeout(() => this.success.set(''), 4000);
        this.charger();
      },
      error: (err) => { this.generating.set(false); this.error.set(this.parseErr(err)); }
    });
  }

  exporterExcel() {
  this.exportingExcel.set(true);
  this.error.set('');
 
  this.http.get(
    `${this.apiUrl}/pointage/export-excel?mois=${this.filtreMois()}&annee=${this.filtreAnnee()}`,
    { responseType: 'blob' }
  ).subscribe({
    next: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointage_${this.filtreMois()}_${this.filtreAnnee()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.exportingExcel.set(false);
    },
    error: (err) => {
      this.exportingExcel.set(false);
      this.error.set('Erreur lors de l\'export Excel');
    }
  });
}

  // ── Lookup jour → JourneeTravail ───────────────────────────────────

  getJournee(p: PointageLigne, jour: number): JourneeTravail | null {
    if (!p.journees) return null;
    const dateStr = this.buildDateStr(jour);
    return p.journees.find(j => j.dateJournee === dateStr) || null;
  }

  private buildDateStr(jour: number): string {
    const m = this.filtreMois().toString().padStart(2, '0');
    const j = jour.toString().padStart(2, '0');
    return `${this.filtreAnnee()}-${m}-${j}`;
  }

  isJourFutur(jour: number): boolean {
    const dateStr = this.buildDateStr(jour);
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  }

  // ── Correction ────────────────────────────────────────────────────

  ouvrirCorrection(p: PointageLigne, jour: number) {
    if (!this.canEdit()) return;
    if (p.statutPointage === 'VALIDE_RH') return;
    if (this.isJourFutur(jour)) return;

    const j = this.getJournee(p, jour);
    this.corrChauffeur.set(p);
    this.corrJournee.set(j);
    this.corrValeur = j ? j.valeurJournee.toFixed(2) : '0.00';
    this.corrCode   = j ? j.codeAffichage : '0';
    this.error.set('');
    this.showCorrModal.set(true);
  }

  sauvegarderCorrection() {
    const p = this.corrChauffeur();
    const j = this.corrJournee();
    if (!p || !j) return;

    this.http.put<PointageLigne>(
      `${this.apiUrl}/pointage/${p.idPointageMensuel}/journees/${j.idJourneeTravail}/corriger`,
      { valeurJournee: parseFloat(this.corrValeur), codeAffichage: this.corrCode }
    ).subscribe({
      next: () => {
        this.showCorrModal.set(false);
        this.success.set('Journée corrigée');
        setTimeout(() => this.success.set(''), 3000);
        this.charger();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Valider ───────────────────────────────────────────────────────

  valider(p: PointageLigne) {
    if (!confirm(`Valider le pointage de ${p.nomChauffeur} ${p.prenomChauffeur} ?`)) return;
    this.http.put(`${this.apiUrl}/pointage/${p.idPointageMensuel}/valider`, {}).subscribe({
      next: () => {
        this.success.set('Pointage validé');
        setTimeout(() => this.success.set(''), 3000);
        this.charger();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Droits ────────────────────────────────────────────────────────

  isRH():    boolean { return this.authService.getDepartement() === 'RH'; }
  canEdit(): boolean { return this.isRH(); }

  peutValider(p: PointageLigne): boolean {
    return this.isRH() && (p.statutPointage === 'GENERE' || p.statutPointage === 'MODIFIE_RH');
  }

  // ── Helpers UI ────────────────────────────────────────────────────

  getMoisLabel(m: number): string {
    return this.moisList.find(x => x.val === m)?.label || '';
  }

  getStatutClass(s: string): string {
    const m: Record<string, string> = {
      GENERE: 'statut-genere', MODIFIE_RH: 'statut-modifie', VALIDE_RH: 'statut-valide'
    };
    return m[s] || '';
  }

  getStatutLabel(s: string): string {
    const m: Record<string, string> = {
      GENERE: 'Généré', MODIFIE_RH: 'Modifié RH', VALIDE_RH: 'Validé ✓'
    };
    return m[s] || s;
  }

  getCelluleClass(code: string | undefined): string {
    if (!code) return 'cell-empty';
    if (code === '0')      return 'cell-vide';
    if (code === 'DEPOT')  return 'cell-depot';
    if (code === 'N')      return 'cell-nat';
    if (code === 'I')      return 'cell-int';
    if (code.includes('/')) return 'cell-mixte';
    return 'cell-vide';
  }

  getJourLabel(jour: number): string {
    const d = new Date(this.filtreAnnee(), this.filtreMois() - 1, jour);
    const jours = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return jours[d.getDay()];
  }

  isWeekend(jour: number): boolean {
    const d = new Date(this.filtreAnnee(), this.filtreMois() - 1, jour);
    return d.getDay() === 0 || d.getDay() === 6;
  }

  private parseErr(err: any): string {
    return err?.error?.message || err?.error || 'Une erreur est survenue';
  }
}