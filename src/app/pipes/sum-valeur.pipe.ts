import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'sumValeur', standalone: true })
export class SumValeurPipe implements PipeTransform {
  transform(items: any[]): number {
    return items?.reduce((sum, item) => sum + (item.valeurJournee || 0), 0) || 0;
  }
}