import { Component, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

interface Message {
  role:    'user' | 'assistant';
  content: string;
  time:    string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent implements AfterViewChecked {

  private apiUrl = 'http://localhost:8080/api';

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  ouvert       = signal(false);
  chargement   = signal(false);
  messageInput = '';
  messages     = signal<Message[]>([]);

  // Message de bienvenue selon le département
  private messagesBienvenue: Record<string, string> = {
    RH:                          "Bonjour ! Je suis votre assistant RH. Posez-moi vos questions sur les absences, le pointage mensuel ou les statistiques chauffeurs.",
    MAINTENANCE:                 "Bonjour ! Je suis votre assistant Maintenance. Posez-moi vos questions sur les pannes ouvertes, les réparations ou l'état du parc véhicules.",
    EXPLOITATION_NATIONALE:      "Bonjour ! Je suis votre assistant Exploitation. Posez-moi vos questions sur les rapports, les chauffeurs disponibles ou les absences du jour.",
    EXPLOITATION_INTERNATIONALE: "Bonjour ! Je suis votre assistant Exploitation. Posez-moi vos questions sur les rapports, les chauffeurs disponibles ou les absences du jour.",
    RESPONSABLE_EXPLOITATION:    "Bonjour ! Je suis votre assistant. Posez-moi vos questions sur l'état des rapports et des équipes.",
    ADMIN:                       "Bonjour ! Je suis votre assistant administrateur. Posez-moi vos questions sur les statistiques globales du système.",
    DEFAULT:                     "Bonjour ! Je suis votre assistant FTA Pointage. Comment puis-je vous aider ?"
  };

  // Suggestions de questions selon le département
  suggestions: Record<string, string[]> = {
    RH: [
      "Combien de chauffeurs sont absents aujourd'hui ?",
      "Quel est l'état du pointage de ce mois ?",
      "Combien de pointages sont encore à valider ?"
    ],
    MAINTENANCE: [
      "Quelles pannes sont actuellement ouvertes ?",
      "Combien de véhicules sont immobilisés ?",
      "Donne-moi les statistiques des pannes."
    ],
    EXPLOITATION_NATIONALE: [
      "Combien de chauffeurs sont disponibles aujourd'hui ?",
      "Quels chauffeurs sont absents ce jour ?",
      "Combien de rapports ont été transmis à RH ce mois ?"
    ],
    EXPLOITATION_INTERNATIONALE: [
      "Combien de chauffeurs sont disponibles aujourd'hui ?",
      "Quels chauffeurs sont absents ce jour ?",
      "Combien de rapports ont été transmis à RH ce mois ?"
    ],
    ADMIN: [
      "Donne-moi un tableau de bord global.",
      "Combien de pannes sont ouvertes ?",
      "Combien de chauffeurs sont actifs ?"
    ]
  };

  constructor(private http: HttpClient, public authService: AuthService) {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  // ── Ouvrir/fermer ─────────────────────────────────────────────────

  toggleChat() {
    this.ouvert.update(v => !v);
    if (this.ouvert() && this.messages().length === 0) {
      this.ajouterMessageBienvenue();
    }
  }

  private ajouterMessageBienvenue() {
    const dept = this.authService.getDepartement();
    const bienvenue = this.messagesBienvenue[dept] || this.messagesBienvenue['DEFAULT'];
    this.messages.update(msgs => [...msgs, {
      role: 'assistant',
      content: bienvenue,
      time: this.getTime()
    }]);
  }

  // ── Envoyer message ───────────────────────────────────────────────

  envoyer() {
    const msg = this.messageInput.trim();
    if (!msg || this.chargement()) return;

    // Ajouter le message utilisateur
    this.messages.update(msgs => [...msgs, {
      role: 'user',
      content: msg,
      time: this.getTime()
    }]);
    this.messageInput = '';
    this.chargement.set(true);

    // Appel backend
    this.http.post<{ reponse: string }>(`${this.apiUrl}/ai/chat`, { message: msg }).subscribe({
      next: (res) => {
        this.messages.update(msgs => [...msgs, {
          role: 'assistant',
          content: res.reponse,
          time: this.getTime()
        }]);
        this.chargement.set(false);
      },
      error: () => {
        this.messages.update(msgs => [...msgs, {
          role: 'assistant',
          content: "Désolé, une erreur est survenue. Veuillez réessayer.",
          time: this.getTime()
        }]);
        this.chargement.set(false);
      }
    });
  }

  // ── Suggestion cliquée ────────────────────────────────────────────

  utiliserSuggestion(suggestion: string) {
    this.messageInput = suggestion;
    this.envoyer();
  }

  // ── Helpers ───────────────────────────────────────────────────────

  getSuggestions(): string[] {
    const dept = this.authService.getDepartement();
    return this.suggestions[dept] || [];
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyer();
    }
  }

  viderConversation() {
    this.messages.set([]);
    this.ajouterMessageBienvenue();
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  private getTime(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}