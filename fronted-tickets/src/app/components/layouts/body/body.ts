import { Component, signal } from '@angular/core';

interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-body',
  standalone: false,
  styleUrl: './body.css',
  templateUrl: './body.html',
})
export class Body {
  collapsed = signal(typeof window !== 'undefined');
  screenWidth = signal(typeof window !== 'undefined' ? window.innerWidth : 0);

  onToggleSideNav(data: SideNavToggle): void {
    this.screenWidth.set(data.screenWidth);
    this.collapsed.set(data.collapsed);
  }
  getBodyClass(): string {
    let styleClass = '';
    if (this.collapsed() && this.screenWidth() > 768) {
      styleClass = 'body-trimmed'; // Sidenav colapsado en pantallas grandes
    } else if (this.collapsed() && this.screenWidth() <= 768 && this.screenWidth() > 0) {
      styleClass = 'body-md-screen'; // Sidenav colapsado en pantallas medianas
    }
    return styleClass;
  }

}