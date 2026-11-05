
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewChecked
} from '@angular/core';
import { AiChatMessageView } from '../../../../models/ai-chat';


@Component({
  selector: 'app-ai-chat-messages',
  standalone: false,
  templateUrl: './ai-chat-messages.html',
  styleUrl: './ai-chat-messages.css'
})
export class AiChatMessages implements AfterViewChecked {

  @Input() mensajes: AiChatMessageView[] = [];
  @Input() cargando = false;
  @Input() respondiendo = false;

  @Output() sugerencia = new EventEmitter<string>();

  @ViewChild('scrollArea')
  scrollArea?: ElementRef<HTMLDivElement>;

  private ultimaFirma = '';

  sugerencias: string[] = [
    '¿Cuántos incidentes se aperturaron en marzo de 2026?',
    'Muéstrame los 5 proyectos con más incidentes.',
    '¿Cuál es el cumplimiento SLA de solución de incidentes?'
  ];

  ngAfterViewChecked(): void {

    const ultimo = this.mensajes.length
      ? this.mensajes[this.mensajes.length - 1]
      : null;

    const firma = [
      this.mensajes.length,
      ultimo?.localId ?? '',
      this.respondiendo
    ].join('|');

    if (
      firma !== this.ultimaFirma &&
      this.scrollArea
    ) {
      this.ultimaFirma = firma;

      const contenedor = this.scrollArea.nativeElement;

      contenedor.scrollTop = contenedor.scrollHeight;
    }
  }

  trackById(
    index: number,
    mensaje: AiChatMessageView
  ): string {
    return mensaje.localId;
  }
}
