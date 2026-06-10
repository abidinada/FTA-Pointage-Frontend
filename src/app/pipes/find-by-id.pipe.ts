import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'findById', standalone: true })
export class FindByIdPipe implements PipeTransform {
  transform(list: any[], id: any, idField: string, labelField: string): string {
    return list?.find(item => item[idField] === id)?.[labelField] || '';
  }
}