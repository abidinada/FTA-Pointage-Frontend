import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Interfaces Sprint 3 ───────────────────────────────────────────

export interface SousRapportResponse {
  idSousRapport:    number;
  idRapport:        number;
  idUserAgent:      number;
  usernameAgent:    string;
  nomPrenomAgent:   string;
  departementAgent: string;
  statut:           'BROUILLON' | 'SOUMIS' | 'RETOURNE' | 'VALIDE';
  motifRetour:      string | null;
  dateSoumission:   string | null;
  nbProgrammes:     number;
  createdAt:        string;
  updatedAt:        string;
  // Programmes de l'agent avec leurs affectations
  programmes?:      any[];
}

export interface AffectationAutreResponse {
  idAffectationAutre: number;
  idRapport:          number;
  idChauffeur:        number;
  nomChauffeur:       string;
  prenomChauffeur:    string;
  typeChauffeur:      string;
  statutJournee:      'DEPOT' | 'MALADIE' | 'REPOS';
  idDureeMission:     number | null;
  libelleDuree:       string | null;
  valeurJournee:      number;
  usernameRh:         string;
  createdAt:          string;
  updatedAt:          string;
}

// ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RapportDetailService {

  private apiUrl = 'http://localhost:8080/api';

  // ── État partagé ──────────────────────────────────────────────────
  missions   = signal<any[]>([]);
  shifts     = signal<any[]>([]);
  chauffeurs = signal<any[]>([]);
  remorques  = signal<any[]>([]);

  tracteurs:    any[] = [];
  voitures:     any[] = [];
  fournisseurs: any[] = [];

  progParTracteur:    { [id: number]: any } = {};
  progParVoiture:     { [id: number]: any } = {};
  progParFournisseur: { [id: number]: any } = {};

  // ── Sprint 3 ──────────────────────────────────────────────────────
  monSousRapport    = signal<SousRapportResponse | null>(null);
  affectationsAutre = signal<AffectationAutreResponse[]>([]);
  dureesMission     = signal<any[]>([]);

  constructor(private http: HttpClient) {}

  // ── Données de référence ──────────────────────────────────────────

  loadDonneesReference() {
    this.http.get<any[]>(`${this.apiUrl}/missions`).subscribe(d => this.missions.set(d));
    this.http.get<any[]>(`${this.apiUrl}/shifts`).subscribe(d => this.shifts.set(d));
    this.http.get<any[]>(`${this.apiUrl}/chauffeurs`).subscribe(d =>
      this.chauffeurs.set(d.filter(c => c.actif)));
    this.http.get<any[]>(`${this.apiUrl}/remorques`).subscribe(d => this.remorques.set(d));
    this.http.get<any[]>(`${this.apiUrl}/durees-mission`).subscribe(d =>
      this.dureesMission.set(d));
    this.http.get<any[]>(`${this.apiUrl}/tracteurs`).subscribe(d => {
      this.tracteurs = d.filter(t => t.statut !== 'VENDU' && t.statut !== 'HORS_SERVICE');
    });
    this.http.get<any[]>(`${this.apiUrl}/voitures-service`).subscribe(d => {
      this.voitures = d.filter(v => {
        const s = v.statutVehicule?.libelle || v.statut || '';
        return s !== 'VENDU' && s !== 'HORS_SERVICE';
      });
    });
    this.http.get<any[]>(`${this.apiUrl}/fournisseurs`).subscribe(d => {
      this.fournisseurs = d;
    });
  }

  // ── Maps ──────────────────────────────────────────────────────────

  construireMaps(programmes: any[], remorqueParTracteur: { [id: number]: number | null }) {
    this.progParTracteur    = {};
    this.progParVoiture     = {};
    this.progParFournisseur = {};

    for (const prog of programmes || []) {
      if (prog.idTracteur)       this.progParTracteur[prog.idTracteur] = prog;
      if (prog.idVoitureService) this.progParVoiture[prog.idVoitureService] = prog;
      if (prog.idFournisseur)    this.progParFournisseur[prog.idFournisseur] = prog;
      if (prog.idTracteur && prog.idRemorque) {
        remorqueParTracteur[prog.idTracteur] = prog.idRemorque;
      }
    }

    for (const t of this.tracteurs) {
      if (!this.progParTracteur[t.idTracteur]) {
        this.progParTracteur[t.idTracteur] = {
          idTracteur: t.idTracteur,
          affectations: [],
          typeProgramme: 'TRACTEUR'
        };
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  Sprint 3 — SOUS-RAPPORT
  // ════════════════════════════════════════════════════════════════

  /** Initialise ou récupère le sous-rapport de l'agent */
  initSousRapport(idRapport: number): Observable<SousRapportResponse> {
    return this.http.post<SousRapportResponse>(
      `${this.apiUrl}/sous-rapports/rapport/${idRapport}/init`, {}
    );
  }

  /** GET le sous-rapport sans créer */
  getMonSousRapport(idRapport: number): Observable<SousRapportResponse> {
    return this.http.get<SousRapportResponse>(
      `${this.apiUrl}/sous-rapports/rapport/${idRapport}/mon`
    );
  }

  /** Agent soumet ses affectations */
  soumettreMonSousRapport(idSousRapport: number): Observable<SousRapportResponse> {
    return this.http.put<SousRapportResponse>(
      `${this.apiUrl}/sous-rapports/${idSousRapport}/soumettre`, {}
    );
  }

  /** Tous les sous-rapports d'un rapport (vue responsable) */
  getSousRapports(idRapport: number): Observable<SousRapportResponse[]> {
    return this.http.get<SousRapportResponse[]>(
      `${this.apiUrl}/sous-rapports/rapport/${idRapport}`
    );
  }

  /** Responsable valide */
  validerSousRapport(idSousRapport: number): Observable<SousRapportResponse> {
    return this.http.put<SousRapportResponse>(
      `${this.apiUrl}/sous-rapports/${idSousRapport}/valider`, {}
    );
  }

  /** Responsable retourne avec motif */
  retournerSousRapport(idSousRapport: number, motif: string): Observable<SousRapportResponse> {
    return this.http.put<SousRapportResponse>(
      `${this.apiUrl}/sous-rapports/${idSousRapport}/retourner`, { motif }
    );
  }

  /** Responsable soumet rapport global vers Qualité */
  soumettreRapportGlobal(idRapport: number): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/sous-rapports/rapport/${idRapport}/soumettre-global`, {}
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  Sprint 3 — BLOC AUTRE (RH)
  // ════════════════════════════════════════════════════════════════

  loadAffectationsAutre(idRapport: number): void {
    this.http.get<AffectationAutreResponse[]>(
      `${this.apiUrl}/affectations-autre/rapport/${idRapport}`
    ).subscribe(d => this.affectationsAutre.set(d));
  }

  creerAffectationAutre(body: {
    idRapport:        number;
    idChauffeur:      number;
    statutJournee:    string;
    idDureeMission?:  number | null;
  }): Observable<AffectationAutreResponse> {
    return this.http.post<AffectationAutreResponse>(
      `${this.apiUrl}/affectations-autre`, body
    );
  }

  modifierAffectationAutre(id: number, body: {
    idRapport:        number;
    idChauffeur:      number;
    statutJournee:    string;
    idDureeMission?:  number | null;
  }): Observable<AffectationAutreResponse> {
    return this.http.put<AffectationAutreResponse>(
      `${this.apiUrl}/affectations-autre/${id}`, body
    );
  }

  supprimerAffectationAutre(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/affectations-autre/${id}`);
  }

  /**
   * Chauffeurs disponibles pour le bloc AUTRE :
   * non affectés à un programme ET pas encore dans le bloc AUTRE
   */
  getChauffeursDisponiblesAutre(): any[] {
    const affectesProg = new Set<number>();
    [
      ...Object.values(this.progParTracteur),
      ...Object.values(this.progParVoiture),
      ...Object.values(this.progParFournisseur)
    ].forEach(prog => {
      (prog.affectations || []).forEach((a: any) => affectesProg.add(a.idChauffeur));
    });

    const dansAutre = new Set(this.affectationsAutre().map(a => a.idChauffeur));

    return this.chauffeurs().filter(c =>
      !affectesProg.has(c.idChauffeur) && !dansAutre.has(c.idChauffeur)
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  Affectations existantes (inchangé)
  // ════════════════════════════════════════════════════════════════

  getAff(prog: any, typeSlot: string, num: number): any {
    return (prog?.affectations || []).find(
      (a: any) => a.typeSlot === typeSlot && a.numeroChauffeur === num
    ) || null;
  }

  getAffShift(prog: any, libelle: string): any {
    return (prog?.affectations || []).find(
      (a: any) => a.libelleShift === libelle
    ) || null;
  }

  getAffFournisseur(prog: any): any {
    return (prog?.affectations || [])[0] || null;
  }

  getTracabilite(prog: any, typeSlot: string, num: number): { nom: string, date: string | null, modifie: boolean } | null {
    const aff = this.getAff(prog, typeSlot, num);
    if (!aff) return null;
    if (aff.nomModificateur) return { nom: aff.nomModificateur, date: aff.dateModification, modifie: true };
    return { nom: aff.nomCreateur || aff.nomUser || '', date: aff.createdAt || null, modifie: false };
  }

  getTracabiliteShift(prog: any, libelle: string): { nom: string, date: string | null, modifie: boolean } | null {
    const aff = this.getAffShift(prog, libelle);
    if (!aff) return null;
    if (aff.nomModificateur) return { nom: aff.nomModificateur, date: aff.dateModification, modifie: true };
    return { nom: aff.nomCreateur || aff.nomUser || '', date: aff.createdAt || null, modifie: false };
  }

  getTracabiliteFournisseur(prog: any): { nom: string, date: string | null, modifie: boolean } | null {
    const aff = this.getAffFournisseur(prog);
    if (!aff) return null;
    if (aff.nomModificateur) return { nom: aff.nomModificateur, date: aff.dateModification, modifie: true };
    return { nom: aff.nomCreateur || aff.nomUser || '', date: aff.createdAt || null, modifie: false };
  }

  verifierConflit(
    idChauffeur: number,
    idMission: number | null,
    idTracteurActuel: number | null,
    typeProgActuel: string
  ): string | null {
    const c = this.chauffeurs().find(c => c.idChauffeur === idChauffeur);
    const nomStr = c ? `${c.nom} ${c.prenom}` : 'Ce chauffeur';

    const tousProgs = [
      ...Object.values(this.progParTracteur),
      ...Object.values(this.progParVoiture),
      ...Object.values(this.progParFournisseur)
    ];

    for (const prog of tousProgs) {
      if (!prog) continue;
      if (typeProgActuel === 'TRACTEUR' && prog.idTracteur === idTracteurActuel) continue;
      if (!(prog.affectations?.length > 0)) continue;

      for (const aff of prog.affectations) {
        if (aff.idChauffeur !== idChauffeur) continue;
        if (typeProgActuel === 'VOITURE_SERVICE' || prog.typeProgramme === 'VOITURE_SERVICE') {
          return `${nomStr} est déjà affecté ailleurs ce jour`;
        }
        if (idMission && aff.idMission) {
          const m1 = this.missions().find(m => m.idMission === idMission);
          const m2 = this.missions().find(m => m.idMission === aff.idMission);
          if (m1 && m2 && this.chevauche(m1, m2)) {
            return `${nomStr} a déjà une mission conflictuelle (${aff.codeAffichage || ''})`;
          }
        }
      }
    }
    return null;
  }

  private chevauche(m1: any, m2: any): boolean {
    if (m1.idMission === m2.idMission) return true;
    const d = (m: any) => m.libelleDuree || (m.typeComposition === 'COMPOSEE' ? 'JOURNEE_COMPLETE' : '');
    const d1 = d(m1); const d2 = d(m2);
    if (!d1 || !d2) return false;
    if (d1 === 'JOURNEE_COMPLETE' || d2 === 'JOURNEE_COMPLETE') return true;
    return d1 === d2;
  }

  getChauffeursInt(): any[] {
    return this.chauffeurs().filter(c => c.typeChauffeur === 'INTERNATIONAL');
  }

  getMissionsNat(): any[] {
    return this.missions().filter(m =>
      m.natureMission === 'NATIONALE' || m.typeComposition === 'COMPOSEE');
  }

  isChauffeurPrisDansTracteurFournisseur(idChauffeur: number): boolean {
    return [
      ...Object.values(this.progParTracteur),
      ...Object.values(this.progParFournisseur)
    ].some(prog => (prog.affectations || []).some((a: any) => a.idChauffeur === idChauffeur));
  }

  getOuChauffeurPris(idChauffeur: number): string {
    for (const prog of [...Object.values(this.progParTracteur), ...Object.values(this.progParFournisseur)]) {
      const aff = (prog.affectations || []).find((a: any) => a.idChauffeur === idChauffeur);
      if (aff) return (prog as any).immatriculationTracteur || (prog as any).nomFournisseur || '';
    }
    return '';
  }

  creerProgrammeTracteur(idRapport: number, idTracteur: number, idRemorque: number | null) {
    return this.http.post<any>(`${this.apiUrl}/programmes`, {
      idRapport, idTracteur, idRemorque: idRemorque || null
    });
  }

  creerProgrammeVoiture(idRapport: number, idVoiture: number) {
    return this.http.post<any>(`${this.apiUrl}/programmes`, { idRapport, idVoitureService: idVoiture });
  }

  creerProgrammeFournisseur(idRapport: number, idFournisseur: number) {
    return this.http.post<any>(`${this.apiUrl}/programmes`, { idRapport, idFournisseur });
  }

  creerAffectation(body: any) {
    return this.http.post<any>(`${this.apiUrl}/affectations`, body);
  }

  supprimerAffectation(idAffectation: number) {
    return this.http.delete(`${this.apiUrl}/affectations/${idAffectation}`);
  }

  parseErr(err: any): string {
    if (typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    return 'Erreur';
  }
}