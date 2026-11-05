import { Component, signal } from '@angular/core';

interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  guia: string = "";
  title = 'fronted-tickets';
  isSideNavCollapsed = false;
  screenWidth = 0;

  ngOnInit() {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem("correo") !== null) {
        this.guia = "logeado";
      } else {
        this.guia = "landing-page";
      }
    }
  }

  onToggleSideNav(data: SideNavToggle): void {
    this.screenWidth = data.screenWidth;
    this.isSideNavCollapsed = data.collapsed;
  }

  habilitarContenido() {
    this.guia = "logeado";
  }

  habilitarLogearse() {
    this.guia = "logearse";
  }

  habilitarLandingPage() {
    this.guia = "landing-page";
  }
}
