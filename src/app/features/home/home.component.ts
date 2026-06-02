import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureCardComponent } from '../../shared/feature-card/feature-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FeatureCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  stats = [
    { n: '150', unit: '+' },
    { n: '98',  unit: '%' },
    { n: '24',  unit: '/7' },
    { n: '3',   unit: '' },
  ];

  statsLabels = [
    'Chauffeurs gérés',
    'Taux de conformité',
    'Suivi continu',
    'Modules intégrés'
  ];
}