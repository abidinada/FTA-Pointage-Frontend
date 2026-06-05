import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class RapportDetailService {

  private apiUrl = 'http://localhost:8080/api';

  // ── État partagé ──────────────────────────────────────────────────
  missions = signal<any[]>([]);
  shifts   = signal<any[]>([]);
  chauffeurs = signal<any[]>([]);
  remorques  = signal<any[]>([]);

  tracteurs:    any[] = [];
  voitures:     any[] = [];
  fournisseurs: any[] = [];

  progParTracteur:    { [id: number]: any } = {};
  progParVoiture:     { [id: number]: any } = {};
  progParFournisseur: { [id: number]: any } = {};

  constructor(private http: HttpClient) {}

  // ── Chargement données de référence ──────────────────────────────

  loadDonneesReference() {
    this.http.get<any[]>(`${this.apiUrl}/missions`).subscribe(d => this.missions.set(d));
    this.http.get<any[]>(`${this.apiUrl}/shifts`).subscribe(d => this.shifts.set(d));
    this.http.get<any[]>(`${this.apiUrl}/chauffeurs`).subscribe(d =>
      this.chauffeurs.set(d.filter(c => c.actif)));
    this.http.get<any[]>(`${this.apiUrl}/remorques`).subscribe(d => this.remorques.set(d));
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

  // ── Construction maps depuis rapport ─────────────────────────────

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

    // Créer des progs virtuels pour les tracteurs sans programme
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

  // ── Affectations ──────────────────────────────────────────────────

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

  // ── Traçabilité ───────────────────────────────────────────────────

  getTracabilite(prog: any, typeSlot: string, num: number): { nom: string, date: string | null, modifie: boolean } | null {
    const aff = this.getAff(prog, typeSlot, num);
    if (!aff) return null;
    if (aff.nomModificateur) {
      return { nom: aff.nomModificateur, date: aff.dateModification, modifie: true };
    }
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

  // ── Vérification conflit ──────────────────────────────────────────
  /**
   * Vérifie si un chauffeur a un conflit dans le rapport
   * @param idChauffeur  chauffeur à vérifier
   * @param idMission    mission à vérifier (null pour voiture)
   * @param idTracteurActuel  id du tracteur ACTUEL (pas l'idProgramme) pour éviter faux positifs
   * @param typeProgActuel   type du programme actuel
   */
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

      // SKIP le programme actuel en utilisant idTracteur/idVoiture/idFournisseur
      // pour éviter le faux positif quand idProgramme n'existe pas encore
      if (typeProgActuel === 'TRACTEUR' && prog.idTracteur === idTracteurActuel) continue;

      if (!(prog.affectations?.length > 0)) continue;

      for (const aff of prog.affectations) {
        if (aff.idChauffeur !== idChauffeur) continue;

        // Règle : voiture ↔ tracteur/fournisseur = interdit
        if (typeProgActuel === 'VOITURE_SERVICE' ||
            prog.typeProgramme === 'VOITURE_SERVICE') {
          return `${nomStr} est déjà affecté ailleurs ce jour`;
        }

        // Règle : tracteur ↔ tracteur = vérifier chevauchement horaire
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
    // Même mission exacte
    if (m1.idMission === m2.idMission) return true;
    const d = (m: any) => m.libelleDuree ||
      (m.typeComposition === 'COMPOSEE' ? 'JOURNEE_COMPLETE' : '');
    const d1 = d(m1); const d2 = d(m2);
    if (!d1 || !d2) return false;
    if (d1 === 'JOURNEE_COMPLETE' || d2 === 'JOURNEE_COMPLETE') return true;
    // MATINEE+MATINEE ou APRES_MIDI+APRES_MIDI = conflit
    return d1 === d2;
    // MATINEE+APRES_MIDI = ok (return false implicite)
  }

  // ── Helpers listes filtrées ───────────────────────────────────────

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
    ].some(prog =>
      (prog.affectations || []).some((a: any) => a.idChauffeur === idChauffeur)
    );
  }

  getOuChauffeurPris(idChauffeur: number): string {
    for (const prog of [
      ...Object.values(this.progParTracteur),
      ...Object.values(this.progParFournisseur)
    ]) {
      const aff = (prog.affectations || []).find((a: any) => a.idChauffeur === idChauffeur);
      if (aff) return (prog as any).immatriculationTracteur || (prog as any).nomFournisseur || '';
    }
    return '';
  }

  // ── CRUD affectations ─────────────────────────────────────────────

  creerProgrammeTracteur(
    idRapport: number,
    idTracteur: number,
    idRemorque: number | null
  ) {
    return this.http.post<any>(`${this.apiUrl}/programmes`, {
      idRapport, idTracteur, idRemorque: idRemorque || null
    });
  }

  creerProgrammeVoiture(idRapport: number, idVoiture: number) {
    return this.http.post<any>(`${this.apiUrl}/programmes`, {
      idRapport, idVoitureService: idVoiture
    });
  }

  creerProgrammeFournisseur(idRapport: number, idFournisseur: number) {
    return this.http.post<any>(`${this.apiUrl}/programmes`, {
      idRapport, idFournisseur
    });
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