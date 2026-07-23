import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureCardComponent } from '../../shared/feature-card/feature-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FeatureCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements AfterViewInit {
  stats = [
    { n: '150', unit: '+' },
    { n: '98',  unit: '%' },
    { n: '24',  unit: '/7' },
    { n: '4',   unit: '' },
  ];

  statsLabels = [
    'Chauffeurs gérés',
    'Taux de conformité',
    'Suivi continu',
    'Modules intégrés'
  ];

  @ViewChild('heroSection') heroSectionRef!: ElementRef<HTMLElement>;

  // ── Camion : entrée puis liée au scroll ──
  truckSettled = signal(false);
  scrollProgress = signal(0); // 0 → 1 sur la hauteur de la section hero

  onTruckAnimationEnd() {
    this.truckSettled.set(true);
  }

  ngAfterViewInit() {
    this.updateScrollProgress();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.updateScrollProgress();
  }

  private updateScrollProgress() {
    if (!this.heroSectionRef) return;
    const rect = this.heroSectionRef.nativeElement.getBoundingClientRect();
    const sectionHeight = rect.height || 1;
    // 0 quand le haut de la section touche le haut de l'écran,
    // 1 quand la section est entièrement défilée (bas de section = haut de l'écran)
    const raw = (-rect.top) / sectionHeight;
    this.scrollProgress.set(Math.min(Math.max(raw, 0), 1));
  }

  truckScrollTransform(): string {
    const p = this.scrollProgress();
    const y = p * 200; // amplitude verticale, comme le rawY d'origine
    return `translateY(${y}px)`;
  }

  textLine1Transform(): string {
    const p = this.scrollProgress();
    return `translateX(${p * -140}px)`;
  }

  textLine2Transform(): string {
    const p = this.scrollProgress();
    return `translateX(${p * 140}px)`;
  }
}