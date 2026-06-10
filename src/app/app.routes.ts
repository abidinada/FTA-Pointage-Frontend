import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [

  
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'chauffeurs',
        canActivate: [authGuard],
        loadComponent: () => import('./features/chauffeurs/chauffeurs.component').then(m => m.ChauffeursComponent),
      },
      {
        path: 'tracteurs',
        canActivate: [authGuard],
        loadComponent: () => import('./features/tracteurs/tracteurs.component').then(m => m.TracteursComponent),
      },
      {
        path: 'remorques',
        canActivate: [authGuard],
        loadComponent: () => import('./features/remorques/remorques.component').then(m => m.RemorquesComponent),
      },
      {
        path: 'voitures-service',
        canActivate: [authGuard],
        loadComponent: () => import('./features/voitures-service/voitures-service.component').then(m => m.VoituresServiceComponent),
      },
      {
        path: 'fournisseurs',
        canActivate: [authGuard],
        loadComponent: () => import('./features/fournisseurs/fournisseurs.component').then(m => m.FournisseursComponent),
      },
      {
        path: 'users',
        canActivate: [authGuard],
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent),
      },
      // ── Sprint 2 ──────────────────────────────────────────────────
      {
        path: 'rapports',
        canActivate: [authGuard],
        loadComponent: () => import('./features/rapports/rapports.component').then(m => m.RapportsComponent),
      },
      {
        path: 'rapports/:id',
        canActivate: [authGuard],
        loadComponent: () => import('./features/rapport-detail/rapport-detail.component').then(m => m.RapportDetailComponent),
      },
      {
        path: 'notifications',
        canActivate: [authGuard],
        loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
      },
      {
        path: 'responsable/rapport/:id',
        canActivate: [authGuard],
        loadComponent: () => import('./features/responsable-rapport/responsable-rapport.component').then(m => m.ResponsableRapportComponent)
      },
      {
        path: 'marques',
        canActivate: [authGuard],
        loadComponent: () => import('./features/marques/marques.component').then(m => m.MarquesComponent)
      }
    ],
  },

  // Login — sans layout
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.Login),
  },

  // 404
  {
    path: '**',
    redirectTo: '',
  },
];