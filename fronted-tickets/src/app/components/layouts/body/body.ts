import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-body',
  standalone: false,
  styleUrl: './body.css',
  templateUrl: './body.html',
})
export class Body {
  @Input() collapsed = false;
  @Input() screenWidth = 0;

  getBodyClass(): string {
    let styleClass = '';
    if (this.collapsed && this.screenWidth > 768) {
      styleClass = 'body-trimmed'; // Sidenav colapsado en pantallas grandes
    } else if (this.collapsed && this.screenWidth <= 768 && this.screenWidth > 0) {
      styleClass = 'body-md-screen' // Sidenav colapsado en pantallas medianas
    }
    return styleClass;
  }

}