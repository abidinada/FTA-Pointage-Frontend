import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { RapportDetailService, SousRapportResponse, AffectationAutreResponse } from './rapport-detail.service';
import { SumValeurPipe } from '../../pipes/sum-valeur.pipe';

@Component({
  selector: 'app-rapport-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SumValeurPipe],
  templateUrl: './rapport-detail.component.html',
  styleUrl: './rapport-detail.component.css',
  providers: [RapportDetailService]
})
export class RapportDetailComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  rapport    = signal<any>(null);
  historique = signal<any[]>([]);

  loading  = signal(false);
  error    = signal('');
  success  = signal('');
  idRapport!: number;

  showRetourModal     = signal(false);
  showHistoriqueModal = signal(false);
  commentaireRetour   = '';
  savingSlot = signal<string>('');

  remorqueParTracteur: { [id: number]: number | null } = {};

  private bufferChauffeur: { [key: string]: number | null } = {};
  private bufferMission:   { [key: string]: number | null } = {};

  autoriserMemeChaufParVoiture: { [idVoiture: number]: boolean } = {};

  // ── Sprint 3 : Sous-rapport ───────────────────────────────────────
  submittingSousRapport = signal(false);

  // ── Sprint 3 : Bloc AUTRE ─────────────────────────────────────────
  showAutreModal      = signal(false);
  autreEnEdition      = signal<AffectationAutreResponse | null>(null);
  autreForm = {
    idChauffeur:    null as number | null,
    statutJournee:  'DEPOT',
    idDureeMission: null as number | null
  };
  savingAutre = signal(false);

  get svc() { return this.rapportSvc; }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService,
    private rapportSvc: RapportDetailService
  ) {}

  ngOnInit() {
    this.idRapport = Number(this.route.snapshot.paramMap.get('id'));
    this.rapportSvc.loadDonneesReference();
    this.loadRapport();
  }

  // ── Chargement ────────────────────────────────────────────────────

  loadRapport() {
    this.loading.set(true);
    this.http.get<any>(`${this.apiUrl}/rapports/${this.idRapport}`).subscribe({
      next: (data) => {
        this.rapport.set(data);
        this.bufferChauffeur = {};
        this.bufferMission   = {};
        this.rapportSvc.construireMaps(data.programmes || [], this.remorqueParTracteur);

        // Sprint 3 : init sous-rapport si agent exploitation
        if (this.isExploitation() && this.isBrouillon()) {
          this.rapportSvc.initSousRapport(this.idRapport).subscribe({
            next: (sr) => this.rapportSvc.monSousRapport.set(sr),
            error: () => {} // silencieux si déjà existant
          });
        }

        // Sprint 3 : charger sous-rapport existant si pas BROUILLON
        if (this.isExploitation() && !this.isBrouillon()) {
          this.rapportSvc.getMonSousRapport(this.idRapport).subscribe({
            next: (sr) => this.rapportSvc.monSousRapport.set(sr),
            error: () => {}
          });
        }

        // Sprint 3 : charger bloc AUTRE si RH ou tous les départements
        this.rapportSvc.loadAffectationsAutre(this.idRapport);

        this.loading.set(false);
      },
      error: () => { this.error.set('Erreur chargement'); this.loading.set(false); }
    });
  }

  loadHistorique() {
    this.http.get<any[]>(`${this.apiUrl}/rapports/${this.idRapport}/historique`).subscribe({
      next: (d) => this.historique.set(d)
    });
  }

  // ── Droits ────────────────────────────────────────────────────────

  dept(): string { return this.authService.getDepartement(); }

  isExploitation(): boolean {
    return this.dept() === 'EXPLOITATION_NATIONALE' ||
           this.dept() === 'EXPLOITATION_INTERNATIONALE';
  }
  isQualite():      boolean { return this.dept() === 'QUALITE'; }
  isAdmin():        boolean { return this.dept() === 'ADMIN'; }
  isAdminVS():      boolean { return this.dept() === 'ADMIN_VS'; }
  isRH():           boolean { return this.dept() === 'RH'; }
  isResponsable():  boolean { return this.dept() === 'RESPONSABLE_EXPLOITATION'; }

  // ── Statuts rapport ───────────────────────────────────────────────

  isBrouillon():        boolean { return this.rapport()?.statutRapport === 'BROUILLON'; }
  isTransmisQualite():  boolean { return this.rapport()?.statutRapport === 'TRANSMIS_QUALITE'; }
  isRetourne():         boolean { return this.rapport()?.statutRapport === 'RETOURNE'; }
  isTransmisRH():       boolean { return this.rapport()?.statutRapport === 'TRANSMIS_RH'; }

  // ── Droits de saisie ──────────────────────────────────────────────

  /**
   * L'agent peut modifier ses affectations si :
   * - Rapport BROUILLON
   * - Son sous-rapport est BROUILLON ou RETOURNE (pas encore soumis)
   */
  canEdit(): boolean {
    if (this.isExploitation()) {
      if (!this.isBrouillon()) return false;
      const sr = this.rapportSvc.monSousRapport();
      if (!sr) return true;
      return sr.statut === 'BROUILLON' || sr.statut === 'RETOURNE';
    }
    if (this.isQualite())     return this.isTransmisQualite();
    if (this.isResponsable()) return this.isRetourne();
    return false;
  }

  canEditVoiture(): boolean {
    return this.isAdminVS() && this.isBrouillon();
  }

  canEditAutre(): boolean {
    return this.isRH() && this.isTransmisRH();
  }

  // ── Statut véhicule ───────────────────────────────────────────────

  getTracteurStatut(t: any): string { return t.statut || ''; }
  getVoitureStatut(v: any): string  { return v.statutVehicule?.libelle || v.statut || ''; }
  isImmobiliseTracteur(t: any):    boolean { return this.getTracteurStatut(t) === 'EN_PANNE_IMMOBILISE'; }
  isImmobiliseVoiture(v: any):     boolean { return this.getVoitureStatut(v)  === 'EN_PANNE_IMMOBILISE'; }
  isPanneAutoriseTracteur(t: any): boolean { return this.getTracteurStatut(t) === 'EN_PANNE_AUTORISE'; }
  isPanneAutoriseVoiture(v: any):  boolean { return this.getVoitureStatut(v)  === 'EN_PANNE_AUTORISE'; }

  // ── Buffer key ────────────────────────────────────────────────────

  private bufferKey(idTracteur: number, typeSlot: string, num: number): string {
    return `t${idTracteur}-${typeSlot}-${num}`;
  }

  getChauffeurAff(idTracteur: number, typeSlot: string, num: number): number | null {
    const key = this.bufferKey(idTracteur, typeSlot, num);
    if (key in this.bufferChauffeur) return this.bufferChauffeur[key];
    const prog = this.svc.progParTracteur[idTracteur];
    return this.svc.getAff(prog, typeSlot, num)?.idChauffeur ?? null;
  }

  getMissionAff(idTracteur: number, typeSlot: string, num: number): number | null {
    const key = this.bufferKey(idTracteur, typeSlot, num);
    if (key in this.bufferMission) return this.bufferMission[key];
    const prog = this.svc.progParTracteur[idTracteur];
    return this.svc.getAff(prog, typeSlot, num)?.idMission ?? null;
  }

  isSlotSaving(key: string): boolean { return this.savingSlot() === key; }
  tracteurKey(idTracteur: number, typeSlot: string, num: number): string {
    return this.bufferKey(idTracteur, typeSlot, num);
  }
  fournisseurKey(id: number): string { return `f-${id}`; }

  // ── Saisie tracteur ───────────────────────────────────────────────

  onChauffeurTracteur(idTracteur: number, typeSlot: string, num: number, idChauffeur: number | null) {
    if (!this.canEdit()) return;
    const key  = this.bufferKey(idTracteur, typeSlot, num);
    const prog = this.svc.progParTracteur[idTracteur];

    if (!idChauffeur) {
      delete this.bufferChauffeur[key];
      delete this.bufferMission[key];
      const aff = this.svc.getAff(prog, typeSlot, num);
      if (aff) this.deleteAff(aff.idAffectation);
      return;
    }

    this.bufferChauffeur[key] = idChauffeur;
    this.tenterSauvegarderTracteur(idTracteur, typeSlot, num, key);
  }

  onMissionTracteur(idTracteur: number, typeSlot: string, num: number, idMission: number | null) {
    if (!this.canEdit()) return;
    const key = this.bufferKey(idTracteur, typeSlot, num);

    if (!idMission) {
      delete this.bufferMission[key];
      const prog = this.svc.progParTracteur[idTracteur];
      const aff  = this.svc.getAff(prog, typeSlot, num);
      if (aff) this.deleteAff(aff.idAffectation);
      return;
    }

    this.bufferMission[key] = idMission;
    this.tenterSauvegarderTracteur(idTracteur, typeSlot, num, key);
  }

  private tenterSauvegarderTracteur(idTracteur: number, typeSlot: string, num: number, key: string) {
    const prog = this.svc.progParTracteur[idTracteur];

    const idChauffeur = this.bufferChauffeur[key]
      ?? this.svc.getAff(prog, typeSlot, num)?.idChauffeur ?? null;
    const idMission   = this.bufferMission[key]
      ?? this.svc.getAff(prog, typeSlot, num)?.idMission   ?? null;

    if (!idChauffeur || !idMission) return;

    const conflit = this.svc.verifierConflit(idChauffeur, idMission, idTracteur, 'TRACTEUR');
    if (conflit) {
      this.error.set(conflit);
      delete this.bufferChauffeur[key];
      delete this.bufferMission[key];
      setTimeout(() => this.error.set(''), 5000);
      this.loadRapport();
      return;
    }

    this.savingSlot.set(key);
    const aff = this.svc.getAff(prog, typeSlot, num);

    const doPost = (idProg: number) => {
      this.svc.creerAffectation({
        idProgramme: idProg, idChauffeur, idMission, typeSlot, numeroChauffeur: num
      }).subscribe({
        next: () => {
          this.savingSlot.set('');
          delete this.bufferChauffeur[key];
          delete this.bufferMission[key];
          this.loadRapport();
        },
        error: (err: any) => {
          this.error.set(this.svc.parseErr(err));
          this.savingSlot.set('');
          setTimeout(() => this.error.set(''), 5000);
          this.loadRapport();
        }
      });
    };

    const doSave = (idProg: number) => {
      if (aff) {
        this.svc.supprimerAffectation(aff.idAffectation).subscribe({
          next: () => doPost(idProg),
          error: () => { this.savingSlot.set(''); this.loadRapport(); }
        });
      } else {
        doPost(idProg);
      }
    };

    if (prog?.idProgramme) {
      doSave(prog.idProgramme);
    } else {
      this.svc.creerProgrammeTracteur(
        this.idRapport, idTracteur, this.remorqueParTracteur[idTracteur] || null
      ).subscribe({
        next: (p) => {
          this.svc.progParTracteur[idTracteur].idProgramme   = p.idProgramme;
          this.svc.progParTracteur[idTracteur].typeProgramme = 'TRACTEUR';
          doSave(p.idProgramme);
        },
        error: (err: any) => { this.error.set(this.svc.parseErr(err)); this.savingSlot.set(''); }
      });
    }
  }

  // ── Saisie voiture ────────────────────────────────────────────────

  onShiftChange(idVoiture: number, libelleShift: string, idChauffeur: number | null) {
    if (!this.canEditVoiture()) return;
    this.error.set('');
    const prog    = this.svc.progParVoiture[idVoiture];
    const idShift = this.svc.shifts().find(s => s.libelle === libelleShift)?.idShift ?? null;
    const aff     = this.svc.getAffShift(prog, libelleShift);

    if (!idChauffeur) {
      if (aff) this.deleteAff(aff.idAffectation);
      return;
    }

    if (this.svc.isChauffeurPrisDansTracteurFournisseur(idChauffeur)) {
      const ou = this.svc.getOuChauffeurPris(idChauffeur);
      this.error.set(`Ce chauffeur est déjà affecté à ${ou}`);
      setTimeout(() => this.error.set(''), 5000);
      this.loadRapport();
      return;
    }

    const affJour = this.svc.getAffShift(prog, 'JOUR');
    if (libelleShift === 'NUIT' &&
        affJour?.idChauffeur === idChauffeur &&
        !this.autoriserMemeChaufParVoiture[idVoiture]) {
      this.error.set('Cochez "Même chauffeur Jour/Nuit" pour autoriser.');
      setTimeout(() => this.error.set(''), 5000);
      return;
    }

    const doPost = (idProg: number) => {
      this.svc.creerAffectation({
        idProgramme: idProg, idChauffeur, idShift, numeroChauffeur: 1,
        autoriserMemeChaufJourNuit: this.autoriserMemeChaufParVoiture[idVoiture] || false
      }).subscribe({
        next: () => this.loadRapport(),
        error: (err: any) => {
          const msg = this.svc.parseErr(err);
          this.error.set(msg.startsWith('MEME_CHAUFFEUR_JOUR_NUIT')
            ? 'Cochez "Même chauffeur Jour/Nuit" pour autoriser.' : msg);
          setTimeout(() => this.error.set(''), 5000);
          this.loadRapport();
        }
      });
    };

    if (aff) {
      this.svc.supprimerAffectation(aff.idAffectation).subscribe({
        next: () => this.assureProgrammeVoiture(idVoiture, doPost),
        error: () => this.loadRapport()
      });
    } else {
      this.assureProgrammeVoiture(idVoiture, doPost);
    }
  }

  private assureProgrammeVoiture(idVoiture: number, callback: (idProg: number) => void) {
    const prog = this.svc.progParVoiture[idVoiture];
    if (prog?.idProgramme) { callback(prog.idProgramme); return; }
    this.svc.creerProgrammeVoiture(this.idRapport, idVoiture).subscribe({
      next: (p) => {
        this.svc.progParVoiture[idVoiture] = {
          idProgramme: p.idProgramme, idVoitureService: idVoiture,
          affectations: [], typeProgramme: 'VOITURE_SERVICE'
        };
        callback(p.idProgramme);
      },
      error: (err: any) => this.error.set(this.svc.parseErr(err))
    });
  }

  voitureADeuxChauffeursDistincts(idVoiture: number): boolean {
    const prog = this.svc.progParVoiture[idVoiture];
    const j = this.svc.getAffShift(prog, 'JOUR');
    const n = this.svc.getAffShift(prog, 'NUIT');
    return !!(j && n && j.idChauffeur !== n.idChauffeur);
  }

  // ── Saisie fournisseur ────────────────────────────────────────────

  onChauffeurFournisseur(idFournisseur: number, idChauffeur: number | null) {
    if (!this.canEdit()) return;
    this.error.set('');
    const prog = this.svc.progParFournisseur[idFournisseur];
    const key  = `f-${idFournisseur}`;

    if (!idChauffeur) {
      delete this.bufferChauffeur[key];
      delete this.bufferMission[key];
      const aff = this.svc.getAffFournisseur(prog);
      if (aff) this.deleteAff(aff.idAffectation);
      return;
    }
    this.bufferChauffeur[key] = idChauffeur;
    this.tenterSauvegarderFournisseur(idFournisseur, key, prog);
  }

  onMissionFournisseur(idFournisseur: number, idMission: number | null) {
    if (!this.canEdit()) return;
    this.error.set('');
    const prog = this.svc.progParFournisseur[idFournisseur];
    const key  = `f-${idFournisseur}`;
    this.bufferMission[key] = idMission;
    this.tenterSauvegarderFournisseur(idFournisseur, key, prog);
  }

  getChauffeurFournisseurVal(idFournisseur: number): number | null {
    const key = `f-${idFournisseur}`;
    if (key in this.bufferChauffeur) return this.bufferChauffeur[key];
    return this.svc.getAffFournisseur(this.svc.progParFournisseur[idFournisseur])?.idChauffeur ?? null;
  }

  getMissionFournisseurVal(idFournisseur: number): number | null {
    const key = `f-${idFournisseur}`;
    if (key in this.bufferMission) return this.bufferMission[key];
    return this.svc.getAffFournisseur(this.svc.progParFournisseur[idFournisseur])?.idMission ?? null;
  }

  private tenterSauvegarderFournisseur(idFournisseur: number, key: string, prog: any) {
    const idChauffeur = this.bufferChauffeur[key] ?? this.svc.getAffFournisseur(prog)?.idChauffeur ?? null;
    const idMission   = this.bufferMission[key]   ?? this.svc.getAffFournisseur(prog)?.idMission   ?? null;
    if (!idChauffeur || !idMission) return;

    const conflit = this.svc.verifierConflit(idChauffeur, idMission, null, 'FOURNISSEUR');
    if (conflit) {
      this.error.set(conflit);
      delete this.bufferChauffeur[key];
      delete this.bufferMission[key];
      setTimeout(() => this.error.set(''), 5000);
      return;
    }

    const chauffeur = this.svc.chauffeurs().find(c => c.idChauffeur === idChauffeur);
    const typeSlot  = chauffeur?.typeChauffeur === 'INTERNATIONAL' ? 'INTERNATIONAL' : 'NATIONAL';
    this.savingSlot.set(key);
    const aff = this.svc.getAffFournisseur(prog);

    const doPost = (idProg: number) => {
      this.svc.creerAffectation({
        idProgramme: idProg, idChauffeur, idMission, typeSlot, numeroChauffeur: 1
      }).subscribe({
        next: () => {
          this.savingSlot.set('');
          delete this.bufferChauffeur[key];
          delete this.bufferMission[key];
          this.loadRapport();
        },
        error: (err: any) => {
          this.error.set(this.svc.parseErr(err));
          this.savingSlot.set('');
          setTimeout(() => this.error.set(''), 5000);
          this.loadRapport();
        }
      });
    };

    const doSave = (idProg: number) => {
      if (aff) {
        this.svc.supprimerAffectation(aff.idAffectation).subscribe({
          next: () => doPost(idProg),
          error: () => { this.savingSlot.set(''); this.loadRapport(); }
        });
      } else { doPost(idProg); }
    };

    if (prog?.idProgramme) {
      doSave(prog.idProgramme);
    } else {
      this.svc.creerProgrammeFournisseur(this.idRapport, idFournisseur).subscribe({
        next: (p) => {
          this.svc.progParFournisseur[idFournisseur] = {
            idProgramme: p.idProgramme, idFournisseur,
            affectations: [], typeProgramme: 'FOURNISSEUR'
          };
          doSave(p.idProgramme);
        },
        error: (err: any) => { this.error.set(this.svc.parseErr(err)); this.savingSlot.set(''); }
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  Sprint 3 — SOUS-RAPPORT
  // ════════════════════════════════════════════════════════════════

  get monSousRapport(): SousRapportResponse | null {
    return this.rapportSvc.monSousRapport();
  }

  get srStatut(): string { return this.monSousRapport?.statut || ''; }
  get srIsBrouillon(): boolean { return this.srStatut === 'BROUILLON'; }
  get srIsSoumis():    boolean { return this.srStatut === 'SOUMIS'; }
  get srIsRetourne():  boolean { return this.srStatut === 'RETOURNE'; }
  get srIsValide():    boolean { return this.srStatut === 'VALIDE'; }

  get peutSoumettreMonSousRapport(): boolean {
    return this.isExploitation() &&
           this.isBrouillon() &&
           (this.srIsBrouillon || this.srIsRetourne);
  }

  soumettreMonSousRapport() {
    const sr = this.monSousRapport;
    if (!sr) return;
    this.submittingSousRapport.set(true);
    this.error.set('');
    this.rapportSvc.soumettreMonSousRapport(sr.idSousRapport).subscribe({
      next: (updated) => {
        this.rapportSvc.monSousRapport.set(updated);
        this.success.set('Affectations soumises au responsable !');
        this.submittingSousRapport.set(false);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err: any) => {
        this.error.set(this.svc.parseErr(err));
        this.submittingSousRapport.set(false);
      }
    });
  }

  srStatutLabel(): string {
    const m: Record<string, string> = {
      BROUILLON: 'En cours de saisie',
      SOUMIS:    'Soumis au responsable',
      RETOURNE:  'Retourné — à corriger',
      VALIDE:    'Validé ✓'
    };
    return m[this.srStatut] || '';
  }

  srStatutClass(): string {
    const m: Record<string, string> = {
      BROUILLON: 'sr-badge-brouillon',
      SOUMIS:    'sr-badge-soumis',
      RETOURNE:  'sr-badge-retourne',
      VALIDE:    'sr-badge-valide'
    };
    return m[this.srStatut] || '';
  }

  // ════════════════════════════════════════════════════════════════
  //  Sprint 3 — BLOC AUTRE (RH)
  // ════════════════════════════════════════════════════════════════

  openAutreModal(aa?: AffectationAutreResponse) {
    this.autreEnEdition.set(aa || null);
    if (aa) {
      this.autreForm = {
        idChauffeur:    aa.idChauffeur,
        statutJournee:  aa.statutJournee,
        idDureeMission: aa.idDureeMission
      };
    } else {
      this.autreForm = { idChauffeur: null, statutJournee: 'DEPOT', idDureeMission: null };
    }
    this.error.set('');
    this.showAutreModal.set(true);
  }

  sauvegarderAutre() {
    if (!this.autreForm.idChauffeur) {
      this.error.set('Sélectionne un chauffeur');
      return;
    }
    //if (this.autreForm.statutJournee === 'DEPOT' && !this.autreForm.idDureeMission) {
     // this.error.set('La durée est obligatoire pour DEPOT');
     // return;
    //}

    this.savingAutre.set(true);
    const body = {
      idRapport:       this.idRapport,
      idChauffeur:     this.autreForm.idChauffeur!,
      statutJournee:   this.autreForm.statutJournee,
  
    };

    const aa = this.autreEnEdition();
    const obs = aa
      ? this.rapportSvc.modifierAffectationAutre(aa.idAffectationAutre, body)
      : this.rapportSvc.creerAffectationAutre(body);

    obs.subscribe({
      next: () => {
        this.showAutreModal.set(false);
        this.savingAutre.set(false);
        this.rapportSvc.loadAffectationsAutre(this.idRapport);
        this.success.set(aa ? 'Modifié' : 'Ajouté au bloc AUTRE');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err: any) => {
        this.error.set(this.svc.parseErr(err));
        this.savingAutre.set(false);
      }
    });
  }

  supprimerAutre(id: number) {
    this.rapportSvc.supprimerAffectationAutre(id).subscribe({
      next: () => this.rapportSvc.loadAffectationsAutre(this.idRapport),
      error: (err: any) => this.error.set(this.svc.parseErr(err))
    });
  }

  getStatutAutreLabel(s: string): string {
    const m: Record<string, string> = {
      DEPOT: 'Dépôt', MALADIE: 'Maladie', REPOS: 'Repos'
    };
    return m[s] || s;
  }

  getStatutAutreClass(s: string): string {
    const m: Record<string, string> = {
      DEPOT: 'autre-depot', MALADIE: 'autre-maladie',
      REPOS: 'autre-repos'
    };
    return m[s] || '';
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private deleteAff(idAff: number) {
    this.svc.supprimerAffectation(idAff).subscribe({
      next: () => this.loadRapport(),
      error: () => this.loadRapport()
    });
  }

  // ── Workflow rapport ──────────────────────────────────────────────

  openRetourModal()  { this.commentaireRetour = ''; this.error.set(''); this.showRetourModal.set(true); }

  retourner() {
    if (!this.commentaireRetour.trim()) { this.error.set('Commentaire obligatoire'); return; }
    this.http.put<any>(`${this.apiUrl}/rapports/${this.idRapport}/retourner`, {
      commentaire: this.commentaireRetour
    }).subscribe({
      next: () => {
        this.success.set('Retourné au responsable');
        this.showRetourModal.set(false);
        this.loadRapport();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(this.svc.parseErr(err))
      
    });
  }

  valider() {
    this.http.put<any>(`${this.apiUrl}/rapports/${this.idRapport}/valider`, {}).subscribe({
      next: () => {
        this.success.set('Validé et transmis RH');
        this.loadRapport();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(this.svc.parseErr(err))
    });
  }

  openHistorique() { this.loadHistorique(); this.showHistoriqueModal.set(true); }

  onRemorqueChange(idTracteur: number, idRemorque: number | null) {
    this.remorqueParTracteur[idTracteur] = idRemorque;
    const prog = this.svc.progParTracteur[idTracteur];
    if (prog?.idProgramme) {
      this.http.put<any>(
        `${this.apiUrl}/programmes/${prog.idProgramme}/remorque`,
        { idRemorque }
      ).subscribe({
        next: () => this.loadRapport(),
        error: (err) => this.error.set(this.svc.parseErr(err))
      });
    }
  }

  getRemorqueDejaUtilisee(idRemorque: number | null, idTracteurActuel: number): string | null {
    if (!idRemorque) return null;
    for (const [idTracteur, prog] of Object.entries(this.svc.progParTracteur)) {
      if (Number(idTracteur) === idTracteurActuel) continue;
      if (prog.idRemorque === idRemorque) {
        return prog.immatriculationTracteur || '';
      }
    }
    return null;
  }

  /**
   * Retourne le statut de la remorque sélectionnée si elle est en panne.
   * Utilisé pour afficher le rappel rouge dans le HTML.
   */
  getRemorqueStatut(idRemorque: number | null): string | null {
    if (!idRemorque) return null;
    const r = this.svc.remorques().find(r => r.idRemorque === idRemorque);
    if (!r) return null;
    const statut = r.statutVehicule?.libelle || r.statut || '';
    if (statut === 'EN_PANNE_IMMOBILISE' || statut === 'EN_PANNE_AUTORISE') {
      return statut;
    }
    return null;
  }

  // ── Badges ────────────────────────────────────────────────────────

  getBadgeClass(s: string): string {
    const m: any = {
      BROUILLON: 'badge-brouillon', SOUMIS: 'badge-soumis',
      RETOURNE: 'badge-retourne', TRANSMIS_RH: 'badge-transmis',
      TRANSMIS_QUALITE: 'badge-qualite'
    };
    return m[s] || 'badge-default';
  }

  getStatutLabel(s: string): string {
    const m: any = {
      BROUILLON: 'Brouillon', SOUMIS: 'Soumis',
      RETOURNE: 'Retourné', TRANSMIS_RH: 'Transmis RH',
      TRANSMIS_QUALITE: 'Transmis Qualité'
    };
    return m[s] || s;
  }

  retournerListe() {
    const dept = this.authService.getDepartement();
    if (dept === 'RESPONSABLE_EXPLOITATION') {
      this.router.navigate(['/responsable/rapport', this.idRapport]);
    } else {
      this.router.navigate(['/rapports']);
    }
  }
}