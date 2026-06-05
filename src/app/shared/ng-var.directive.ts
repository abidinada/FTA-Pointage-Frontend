import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';


@Directive({
  selector: '[ngVar]',
  standalone: true
})
export class NgVarDirective<T> {
  private context: { ngVar: T | null; $implicit: T | null } = {
    ngVar: null,
    $implicit: null
  };

  constructor(
    private vcRef: ViewContainerRef,
    private templateRef: TemplateRef<{ ngVar: T; $implicit: T }>
  ) {
    this.vcRef.createEmbeddedView(this.templateRef, this.context);
  }

  @Input()
  set ngVar(value: T) {
    this.context.ngVar = value;
    this.context.$implicit = value;
  }
}