import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'countStatut', standalone: true })
export class CountStatutPipe implements PipeTransform {
  transform(pointages: any[], statut: string): number {
    return pointages.filter(p => p.statutPointage === statut).length;
  }
}