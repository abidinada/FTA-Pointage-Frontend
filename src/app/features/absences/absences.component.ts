import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

interface Absence {
  idAbsence:          number;
  idChauffeur:        number;
  nomChauffeur:       string;
  prenomChauffeur:    string;
  typeChauffeur:      string;
  dateDebut:          string;
  dateFin:            string;
  idTypeAbsence:      number;
  libelleTypeAbsence: string;
  commentaire:        string;
  usernameCreateur:   string;
}

interface TypeAbsence {
  idTypeAbsence: number;
  libelle:       string;
}

interface Chauffeur {
  idChauffeur:   number;
  nom:           string;
  prenom:        string;
  typeChauffeur: string;
  actif:         boolean;
}

interface PresenceMois {
  key: string;
  mois: number;
  annee: number;
  label: string;
  year: number;
  presentPct: number;
  absentPct: number;
  hasData: boolean;
}

@Component({
  selector: 'app-absences',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './absences.component.html',
  styleUrl: './absences.component.css'
})
export class AbsencesComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  absences     = signal<Absence[]>([]);
  typesAbsence = signal<TypeAbsence[]>([]);
  chauffeurs   = signal<Chauffeur[]>([]);

  loading   = signal(false);
  error     = signal('');
  success   = signal('');
  showModal = signal(false);
  enEdition = signal<Absence | null>(null);
  saving    = signal(false);

  filtreNom  = signal('');
  filtreType = signal('');

  form = {
    idChauffeur:   null as number | null,
    dateDebut:     '',
    dateFin:       '',
    idTypeAbsence: null as number | null,
    commentaire:   ''
  };

  // FIX : pré-remplissage depuis le lien "Déclarer une absence" du Bloc AUTRE
  // (rapport-detail) — mémorise si l'ouverture vient de ce deep-link, pour
  // afficher un petit rappel contextuel dans le modal si besoin.
  depuisBlocAutre = signal(false);

  absencesFiltrees = computed(() => {
    let list = this.absences();
    const nom  = this.filtreNom().toLowerCase().trim();
    const type = this.filtreType();
    if (nom)  list = list.filter(a =>
      (a.nomChauffeur + ' ' + a.prenomChauffeur).toLowerCase().includes(nom));
    if (type) list = list.filter(a => a.idTypeAbsence === Number(type));
    return list;
  });

  // ── Insights : absents aujourd'hui + répartition par type ──────────

  absentsAujourdhui = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateDebut <= today && a.dateFin >= today);
  });

  typeBreakdown = computed(() => {
    const counts: Record<string, number> = {};
    this.absences().forEach(a => {
      counts[a.libelleTypeAbsence] = (counts[a.libelleTypeAbsence] || 0) + 1;
    });
    const colors: Record<string, string> = {
      CONGE_ANNUEL:  '#0ca30c',
      CONGE_MALADIE: '#fab219',
      SUSPENSION:    '#d82929',
      FORMATION:     '#135ddc',
      AUTRE:         '#6B7280'
    };
    return Object.keys(counts)
      .map(key => ({
        key,
        label: this.getTypeLabel(key),
        count: counts[key],
        color: colors[key] || '#64748b'
      }))
      .sort((a, b) => b.count - a.count);
  });

  dominantType = computed(() => {
    const data = this.typeBreakdown();
    return data.length > 0 ? data[0] : null;
  });

  dominantPercent = computed(() => {
    const total = this.absences().length;
    const dom = this.dominantType();
    if (!dom || total === 0) return 0;
    return Math.round((dom.count / total) * 100);
  });

  donutSegments = computed(() => {
    const total = this.absences().length;
    const data = this.typeBreakdown();

    if (total === 0) return { mode: 'empty' as const, segments: [] as { path: string; color: string }[], singleColor: '' };
    if (data.length === 1) return { mode: 'single' as const, segments: [], singleColor: data[0].color };

    const center = 110, radius = 75, explode = 4;
    let startAngle = 0;
    const segments = data.map(d => {
      const angle = (d.count / total) * 360;
      const endAngle = startAngle + angle;
      const midAngle = startAngle + angle / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const offsetX = Math.cos(rad) * explode;
      const offsetY = Math.sin(rad) * explode;
      const path = this.describeSlice(center + offsetX, center + offsetY, radius, startAngle, endAngle);
      startAngle = endAngle;
      return { path, color: d.color };
    });

    return { mode: 'multi' as const, segments, singleColor: '' };
  });

  private polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
  }

  private describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(cx, cy, r, endAngle);
    const end = this.polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  }

  getInitiales(nom: string, prenom: string): string {
    return ((nom?.[0] || '') + (prenom?.[0] || '')).toUpperCase();
  }

  // ── Taux de présence mensuel (données réelles depuis /api/pointage) ──

  private readonly moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  private readonly chartWidth = 860;
  private readonly chartHeight = 190;
  private readonly padLeft = 30;
  private readonly padTop = 20;
  readonly viewBoxW = 900;
  readonly viewBoxH = 250;

  hoveredIndex = signal<number | null>(null);
  presenceLoading = signal(false);

  presenceMensuel = signal<PresenceMois[]>([]);

  loadPresenceMensuelle() {
    this.presenceLoading.set(true);
    const now = new Date();
    const requests = [];
    const meta: { mois: number; annee: number; label: string; key: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = d.getMonth() + 1;
      const annee = d.getFullYear();
      meta.push({ mois, annee, label: this.moisLabels[d.getMonth()], key: `${annee}-${mois}` });
      requests.push(this.http.get<any[]>(`${this.apiUrl}/pointage/calendrier?mois=${mois}&annee=${annee}`));
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        const data: PresenceMois[] = results.map((list, idx) => {
          const m = meta[idx];
          const daysInMonth = new Date(m.annee, m.mois, 0).getDate();

          if (!list || list.length === 0) {
            return { ...m, year: m.annee, presentPct: 0, absentPct: 0, hasData: false };
          }

          const totalJours = list.reduce((sum, p) => sum + Number(p.totalJoursTravailles || 0), 0);
          const totalPossible = list.length * daysInMonth;
          const presentPct = totalPossible > 0 ? Math.round((totalJours / totalPossible) * 1000) / 10 : 0;
          const clamped = Math.min(100, presentPct);

          return { ...m, year: m.annee, presentPct: clamped, absentPct: Math.max(0, 100 - clamped), hasData: true };
        });
        this.presenceMensuel.set(data);
        this.presenceLoading.set(false);
      },
      error: () => this.presenceLoading.set(false)
    });
  }

  presenceRangeLabel = computed(() => {
    const m = this.presenceMensuel();
    if (m.length === 0) return '';
    const first = m[0], last = m[m.length - 1];
    return `${first.label.toUpperCase()} - ${last.label.toUpperCase()} ${last.year}`;
  });

  private xAt(index: number, total: number): number {
    const step = this.chartWidth / Math.max(1, total - 1);
    return this.padLeft + step * index;
  }

  private yAt(pct: number): number {
    return this.padTop + (100 - pct) / 100 * this.chartHeight;
  }

  presenceChartPoints = computed(() => {
    const data = this.presenceMensuel();
    return data.map((d, i) => ({
      ...d,
      xPresent: this.xAt(i, data.length),
      yPresent: this.yAt(d.presentPct),
      xAbsent: this.xAt(i, data.length),
      yAbsent: this.yAt(d.absentPct)
    }));
  });

  private buildGappedPath(getY: (p: any) => number): string {
    const pts = this.presenceChartPoints();
    if (pts.length === 0) return '';
    let path = '';
    let drawing = false;
    pts.forEach((p) => {
      if (!p.hasData) { drawing = false; return; }
      const x = p.xPresent;
      const y = getY(p);
      path += drawing ? ` L ${x} ${y}` : `${path ? ' ' : ''}M ${x} ${y}`;
      drawing = true;
    });
    return path;
  }

  presentLinePath = computed(() => this.buildGappedPath(p => p.yPresent));
  absentLinePath  = computed(() => this.buildGappedPath(p => p.yAbsent));

  presentAreaPath = computed(() => {
    const pts = this.presenceChartPoints().filter(p => p.hasData);
    if (pts.length === 0) return '';
    const baseline = this.padTop + this.chartHeight;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPresent} ${p.yPresent}`).join(' ');
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.xPresent} ${baseline} L ${first.xPresent} ${baseline} Z`;
  });

  hoveredPoint = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    const pts = this.presenceChartPoints();
    return pts[idx] || null;
  });

  onChartMove(event: MouseEvent) {
    const target = event.currentTarget as SVGSVGElement;
    const rect = target.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const viewBoxX = relX * this.viewBoxW;

    const pts = this.presenceChartPoints();
    if (pts.length === 0) return;

    let closestIdx = 0;
    let closestDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.xPresent - viewBoxX);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    this.hoveredIndex.set(closestIdx);
  }

  onChartLeave() {
    this.hoveredIndex.set(null);
  }

  tooltipLeftPct = computed(() => {
    const p = this.hoveredPoint();
    return p ? (p.xPresent / this.viewBoxW) * 100 : 0;
  });

  tooltipTopPct = computed(() => {
    const p = this.hoveredPoint();
    return p ? (p.yPresent / this.viewBoxH) * 100 : 0;
  });

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadAll();
    this.loadPresenceMensuelle();
  }

  // ── Chargement ────────────────────────────────────────────────────

  loadAll() {
    this.loading.set(true);
    this.http.get<Absence[]>(`${this.apiUrl}/absences`).subscribe({
      next: (d) => {
        this.absences.set(d);
        this.loading.set(false);
        // FIX : une fois les chauffeurs chargés, on regarde s'il faut
        // ouvrir automatiquement le modal via le deep-link du Bloc AUTRE.
        this.ouvrirDepuisQueryParamsSiPresent();
      },
      error: ()  => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
    this.http.get<TypeAbsence[]>(`${this.apiUrl}/types-absence`).subscribe({
      next: (d) => this.typesAbsence.set(d)
    });
    this.http.get<Chauffeur[]>(`${this.apiUrl}/chauffeurs`).subscribe({
      next: (d) => this.chauffeurs.set(d.filter(c => c.actif))
    });
  }

  // FIX : lit ?idChauffeur=&date= posés par le lien "Déclarer une absence"
  // du Bloc AUTRE (rapport-detail) et pré-remplit + ouvre le modal de
  // création directement, pour éviter à RH de ressaisir chauffeur et date.
  private ouvrirDepuisQueryParamsSiPresent() {
    const params = this.route.snapshot.queryParams;
    const idChauffeur = params['idChauffeur'] ? Number(params['idChauffeur']) : null;
    const date = params['date'] || null;

    if (idChauffeur) {
      this.depuisBlocAutre.set(true);
      this.enEdition.set(null);
      this.form = {
        idChauffeur,
        dateDebut: date || '',
        dateFin: date || '',
        idTypeAbsence: null,
        commentaire: ''
      };
      this.showModal.set(true);
      // Nettoie l'URL pour éviter de rouvrir le modal si l'utilisateur
      // recharge la page ou navigue en arrière.
      this.router.navigate([], { queryParams: {} });
    }
  }

  // ── Droits ────────────────────────────────────────────────────────

  canEdit(): boolean {
    const d = this.authService.getDepartement();
    return d === 'RH' || d === 'ADMIN';
  }

  // ── Modal ─────────────────────────────────────────────────────────

  openModal(absence?: Absence) {
    this.error.set('');
    this.depuisBlocAutre.set(false);
    if (absence) {
      this.enEdition.set(absence);
      this.form = {
        idChauffeur:   absence.idChauffeur,
        dateDebut:     absence.dateDebut,
        dateFin:       absence.dateFin,
        idTypeAbsence: absence.idTypeAbsence,
        commentaire:   absence.commentaire || ''
      };
    } else {
      this.enEdition.set(null);
      this.form = { idChauffeur: null, dateDebut: '', dateFin: '', idTypeAbsence: null, commentaire: '' };
    }
    this.showModal.set(true);
  }

  fermerModal() { this.showModal.set(false); this.error.set(''); this.depuisBlocAutre.set(false); }

  // ── Sauvegarder ───────────────────────────────────────────────────

  sauvegarder() {
    if (!this.form.idChauffeur)   { this.error.set('Sélectionnez un chauffeur'); return; }
    if (!this.form.dateDebut || !this.form.dateFin) {
      this.error.set('Les dates sont obligatoires'); return;
    }
    if (!this.form.idTypeAbsence) { this.error.set("Sélectionnez un type d'absence"); return; }
    if (this.form.dateFin < this.form.dateDebut) {
      this.error.set('La date de fin doit être après la date de début'); return;
    }

    this.saving.set(true);
    this.error.set('');

    const body = {
      idChauffeur:   this.form.idChauffeur,
      dateDebut:     this.form.dateDebut,
      dateFin:       this.form.dateFin,
      idTypeAbsence: this.form.idTypeAbsence,
      commentaire:   this.form.commentaire || null
    };

    const abs = this.enEdition();
    const req = abs
      ? this.http.put<Absence>(`${this.apiUrl}/absences/${abs.idAbsence}`, body)
      : this.http.post<Absence>(`${this.apiUrl}/absences`, body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.depuisBlocAutre.set(false);
        this.success.set(abs ? 'Absence modifiée' : 'Absence enregistrée');
        setTimeout(() => this.success.set(''), 3000);
        this.loadAll();
      },
      error: (err) => { this.saving.set(false); this.error.set(this.parseErr(err)); }
    });
  }

  // ── Supprimer ─────────────────────────────────────────────────────

  supprimer(id: number) {
    if (!confirm('Supprimer cette absence ?')) return;
    this.http.delete(`${this.apiUrl}/absences/${id}`).subscribe({
      next: () => {
        this.success.set('Absence supprimée');
        setTimeout(() => this.success.set(''), 3000);
        this.loadAll();
      },
      error: (err) => this.error.set(this.parseErr(err))
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────

  getTypeLabel(libelle: string): string {
    const m: Record<string, string> = {
      CONGE_ANNUEL:  'Congé annuel',   CONGE_MALADIE: 'Congé maladie',
      SUSPENSION:    'Suspension',     FORMATION:     'Formation',
      AUTRE:         'Autre'
    };
    return m[libelle] || libelle;
  }

  getTypeClass(libelle: string): string {
    const m: Record<string, string> = {
      CONGE_ANNUEL:  'badge-conge',   CONGE_MALADIE: 'badge-maladie',
      SUSPENSION:    'badge-suspension', FORMATION:   'badge-formation',
      AUTRE:         'badge-autre'
    };
    return m[libelle] || 'badge-autre';
  }

  isAbsenceActive(a: Absence): boolean {
    const today = new Date().toISOString().split('T')[0];
    return a.dateDebut <= today && a.dateFin >= today;
  }

  isAbsenceAVenir(a: Absence): boolean {
    return a.dateDebut > new Date().toISOString().split('T')[0];
  }

  getStatutAbsence(a: Absence): string {
    if (this.isAbsenceActive(a)) return 'EN COURS';
    if (this.isAbsenceAVenir(a)) return 'À VENIR';
    return 'TERMINÉE';
  }

  getStatutClass(a: Absence): string {
    if (this.isAbsenceActive(a)) return 'statut-encours';
    if (this.isAbsenceAVenir(a)) return 'statut-avenir';
    return 'statut-termine';
  }

  getNbJours(a: Absence): number {
    const diff = new Date(a.dateFin).getTime() - new Date(a.dateDebut).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  get nbEnCours(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateDebut <= today && a.dateFin >= today).length;
  }

  get nbAVenir(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateDebut > today).length;
  }

  get nbTerminees(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.absences().filter(a => a.dateFin < today).length;
  }

  getNbJoursForm(): number {
    if (!this.form.dateDebut || !this.form.dateFin || this.form.dateFin < this.form.dateDebut) return 0;
    const diff = new Date(this.form.dateFin).getTime() - new Date(this.form.dateDebut).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  private parseErr(err: any): string {
    return err?.error?.message || err?.error || 'Une erreur est survenue';
  }
}