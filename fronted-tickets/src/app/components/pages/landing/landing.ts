import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-landing',
  standalone: false,
  styleUrl: './landing.css',
  templateUrl: './landing.html',
})
export class Landing {
  @Output() logearse = new EventEmitter<void>();

  irALogear() {
    this.logearse.emit();
  }
}
