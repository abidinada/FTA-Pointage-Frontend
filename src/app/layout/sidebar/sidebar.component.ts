import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, MatIconModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

  collapsed = signal(false);

  constructor(public authService: AuthService) {}

  toggleSidebar() {
    this.collapsed.set(!this.collapsed());
  }

  get menuItems() {
    const dept = this.authService.getDepartement();

    const all = [
      {
        label: 'Tableau de bord',
        icon: 'dashboard',
        route: '/dashboard',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'RH', 'MAINTENANCE', 'RESPONSABLE_EXPLOITATION', 'ADMIN_VS']
      },
      {
        label: 'Utilisateurs',
        icon: 'manage_accounts',
        route: '/users',
        depts: ['ADMIN']
      },
      {
        label: 'Chauffeurs',
        icon: 'people',
        route: '/chauffeurs',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'RH', 'RESPONSABLE_EXPLOITATION', 'ADMIN_VS']
      },
      {
        label: 'Marques',
        icon: 'label',
        route: '/marques',
        depts: ['ADMIN']
      },
      {
        label: 'Tracteurs',
        icon: 'local_shipping',
        route: '/tracteurs',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE','QUALITE', 'MAINTENANCE', 'RESPONSABLE_EXPLOITATION', 'ADMIN_VS']
      },
      {
        label: 'Remorques',
        icon: 'inventory_2',
        route: '/remorques',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE','QUALITE', 'MAINTENANCE', 'RESPONSABLE_EXPLOITATION', 'ADMIN_VS']
      },
      {
        label: 'Voitures service',
        icon: 'directions_car',
        route: '/voitures-service',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE','QUALITE', 'MAINTENANCE', 'RESPONSABLE_EXPLOITATION', 'ADMIN_VS']
      },
      {
        label: 'Fournisseurs',
        icon: 'business',
        route: '/fournisseurs',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'RH', 'MAINTENANCE', 'RESPONSABLE_EXPLOITATION', 'ADMIN_VS']
      },
      {
        label: 'Rapports',
        icon: 'assignment',
        route: '/rapports',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'RH','ADMIN_VS', 'RESPONSABLE_EXPLOITATION']
      },
      {
        label: 'Notifications',
        icon: 'notifications',
        route: '/notifications',
        depts: ['ADMIN', 'EXPLOITATION_NATIONALE', 'EXPLOITATION_INTERNATIONALE', 'QUALITE', 'RH', 'MAINTENANCE','ADMIN_VS', 'RESPONSABLE_EXPLOITATION']
      }

    ];

    return all.filter(item => item.depts.includes(dept));
  }
}