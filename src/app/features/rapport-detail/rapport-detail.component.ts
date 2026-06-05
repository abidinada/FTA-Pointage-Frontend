import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { RapportDetailService } from './rapport-detail.service';

@Component({
  selector: 'app-rapport-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './rapport-detail.component.html',
  styleUrl: './rapport-detail.component.css',
  providers: [RapportDetailService]
})
export class RapportDetailComponent implements OnInit {

  private apiUrl = 'http://localhost:8080/api';

  rapport = signal<any>(null);
  historique = signal<any[]>([]);

  loading = signal(false);
  error   = signal('');
  success = signal('');
  idRapport!: number;

  showRetourModal     = signal(false);
  showHistoriqueModal = signal(false);
  commentaireRetour   = '';
  savingSlot = signal<string>('');

  remorqueParTracteur: { [id: number]: number | null } = {};

  // Buffer : attend chauffeur + mission avant de sauvegarder
  private bufferChauffeur: { [key: string]: number | null } = {};
  private bufferMission:   { [key: string]: number | null } = {};

  autoriserMemeChaufParVoiture: { [idVoiture: number]: boolean } = {};

  // Exposer le service au template
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

  // ── Chargement rapport ────────────────────────────────────────────

  loadRapport() {
    this.loading.set(true);
    this.http.get<any>(`${this.apiUrl}/rapports/${this.idRapport}`).subscribe({
      next: (data) => {
        this.rapport.set(data);
        this.bufferChauffeur = {};
        this.bufferMission   = {};
        this.rapportSvc.construireMaps(data.programmes || [], this.remorqueParTracteur);
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
  isQualite():  boolean { return this.dept() === 'QUALITE'; }
  isAdmin():    boolean { return this.dept() === 'ADMIN'; }
  isAdminVS():  boolean { return this.dept() === 'ADMIN_VS'; }

  isBrouillon(): boolean { return this.rapport()?.statutRapport === 'BROUILLON'; }
  isSoumis():    boolean { return this.rapport()?.statutRapport === 'SOUMIS'; }
  isRetourne():  boolean { return this.rapport()?.statutRapport === 'RETOURNE'; }
  isTransmis():  boolean { return this.rapport()?.statutRapport === 'TRANSMIS_RH'; }

  canEdit(): boolean {
    if (this.isExploitation()) return this.isBrouillon() || this.isRetourne();
    if (this.isQualite())      return this.isSoumis();
    return false;
  }

  canEditVoiture(): boolean {
    return this.isAdminVS() && (this.isBrouillon() || this.isRetourne());
  }

  // ── Statut véhicule ───────────────────────────────────────────────

  getTracteurStatut(t: any): string { return t.statut || ''; }
  getVoitureStatut(v: any): string  { return v.statutVehicule?.libelle || v.statut || ''; }
  isImmobiliseTracteur(t: any):    boolean { return this.getTracteurStatut(t) === 'EN_PANNE_IMMOBILISE'; }
  isImmobiliseVoiture(v: any):     boolean { return this.getVoitureStatut(v)  === 'EN_PANNE_IMMOBILISE'; }
  isPanneAutoriseTracteur(t: any): boolean { return this.getTracteurStatut(t) === 'EN_PANNE_AUTORISE'; }
  isPanneAutoriseVoiture(v: any):  boolean { return this.getVoitureStatut(v)  === 'EN_PANNE_AUTORISE'; }

  // ── Clé buffer ────────────────────────────────────────────────────
  // On utilise idTracteur (pas idProgramme) pour avoir une clé stable
  // même avant la création du programme

  private bufferKey(idTracteur: number, typeSlot: string, num: number): string {
    return `t${idTracteur}-${typeSlot}-${num}`;
  }

  // ── Valeurs affichées (buffer prioritaire sur base) ───────────────

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
      // Effacer la mission du buffer
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

    // Lire les deux valeurs depuis buffer EN PRIORITÉ, puis base
    const idChauffeur = this.bufferChauffeur[key]
      ?? this.svc.getAff(prog, typeSlot, num)?.idChauffeur ?? null;
    const idMission   = this.bufferMission[key]
      ?? this.svc.getAff(prog, typeSlot, num)?.idMission   ?? null;

    // Attendre que les DEUX soient renseignés
    if (!idChauffeur || !idMission) return;

    // Vérification conflit — on passe idTracteur pour skip le bon programme
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
      // Créer le programme tracteur
      this.svc.creerProgrammeTracteur(
        this.idRapport, idTracteur, this.remorqueParTracteur[idTracteur] || null
      ).subscribe({
        next: (p) => {
          this.svc.progParTracteur[idTracteur].idProgramme = p.idProgramme;
          this.svc.progParTracteur[idTracteur].typeProgramme = 'TRACTEUR';
          doSave(p.idProgramme);
        },
        error: (err: any) => { this.error.set(this.svc.parseErr(err)); this.savingSlot.set(''); }
      });
    }
  }

  // ── Saisie voiture de service ─────────────────────────────────────

  onShiftChange(idVoiture: number, libelleShift: string, idChauffeur: number | null) {
    if (!this.canEditVoiture()) return;
    this.error.set('');
    const prog    = this.svc.progParVoiture[idVoiture];
    const idShift = this.svc.shifts().find(s => s.libelle === libelleShift)?.idShift ?? null;
    const aff     = this.svc.getAffShift(prog, libelleShift);

    // Effacer
    if (!idChauffeur) {
      if (aff) this.deleteAff(aff.idAffectation);
      return;
    }

    // Vérifier chauffeur pas dans tracteur/fournisseur
    if (this.svc.isChauffeurPrisDansTracteurFournisseur(idChauffeur)) {
      const ou = this.svc.getOuChauffeurPris(idChauffeur);
      this.error.set(`Ce chauffeur est déjà affecté à ${ou}`);
      setTimeout(() => this.error.set(''), 5000);
      this.loadRapport();
      return;
    }

    // Vérifier même chauffeur JOUR+NUIT
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
            ? 'Cochez "Même chauffeur Jour/Nuit" pour autoriser.'
            : msg);
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

    // Pour fournisseur on ne passe pas idTracteur — on passe null pour le type FOURNISSEUR
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

  // ── Helpers template ─────────────────────────────────────────────

  private deleteAff(idAff: number) {
    this.svc.supprimerAffectation(idAff).subscribe({
      next: () => this.loadRapport(),
      error: () => this.loadRapport()
    });
  }

  // ── Workflow ──────────────────────────────────────────────────────

  soumettre() {
    this.http.put<any>(`${this.apiUrl}/rapports/${this.idRapport}/soumettre`, {}).subscribe({
      next: () => { this.success.set('Soumis'); this.loadRapport(); setTimeout(() => this.success.set(''), 3000); },
      error: (err) => this.error.set(this.svc.parseErr(err))
    });
  }
  resoumettre() {
    this.http.put<any>(`${this.apiUrl}/rapports/${this.idRapport}/resoumettre`, {}).subscribe({
      next: () => { this.success.set('Re-soumis'); this.loadRapport(); setTimeout(() => this.success.set(''), 3000); },
      error: (err) => this.error.set(this.svc.parseErr(err))
    });
  }
  openRetourModal() { this.commentaireRetour = ''; this.error.set(''); this.showRetourModal.set(true); }
  retourner() {
    if (!this.commentaireRetour.trim()) { this.error.set('Commentaire obligatoire'); return; }
    this.http.put<any>(`${this.apiUrl}/rapports/${this.idRapport}/retourner`, {
      commentaire: this.commentaireRetour
    }).subscribe({
      next: () => {
        this.success.set('Retourné');
        this.showRetourModal.set(false);
        this.loadRapport();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(this.svc.parseErr(err))
    });
  }
  valider() {
    this.http.put<any>(`${this.apiUrl}/rapports/${this.idRapport}/valider`, {}).subscribe({
      next: () => { this.success.set('Validé et transmis RH'); this.loadRapport(); setTimeout(() => this.success.set(''), 3000); },
      error: (err) => this.error.set(this.svc.parseErr(err))
    });
  }
  openHistorique() { this.loadHistorique(); this.showHistoriqueModal.set(true); }

  getBadgeClass(s: string): string {
    const m: any = { BROUILLON: 'badge-brouillon', SOUMIS: 'badge-soumis', RETOURNE: 'badge-retourne', TRANSMIS_RH: 'badge-transmis' };
    return m[s] || 'badge-default';
  }
  getStatutLabel(s: string): string {
    const m: any = { BROUILLON: 'Brouillon', SOUMIS: 'Soumis', RETOURNE: 'Retourné', TRANSMIS_RH: 'Transmis RH' };
    return m[s] || s;
  }
  retournerListe() { this.router.navigate(['/rapports']); }

  onRemorqueChange(idTracteur: number, idRemorque: number | null) {
  this.remorqueParTracteur[idTracteur] = idRemorque;
  const prog = this.svc.progParTracteur[idTracteur];

  // Si le programme existe déjà → mettre à jour via PUT
  if (prog?.idProgramme) {
    this.http.put<any>(
      `${this.apiUrl}/programmes/${prog.idProgramme}/remorque`,
      { idRemorque: idRemorque }
    ).subscribe({
      next: () => this.loadRapport(),
      error: (err) => this.error.set(this.svc.parseErr(err))
    });
  }
  // Sinon → sera pris en compte à la création du programme
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
}

