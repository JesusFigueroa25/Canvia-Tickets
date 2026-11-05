
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AiChatConversationSummary } from '../../../../models/ai-chat';


@Component({
  selector: 'app-ai-chat-sidebar',
  standalone: false,
  templateUrl: './ai-chat-sidebar.html',
  styleUrl: './ai-chat-sidebar.css'
})
export class AiChatSidebar {

  @Input() conversaciones: AiChatConversationSummary[] = [];
  @Input() conversacionSeleccionada: number | null = null;
  @Input() cargando = false;
  @Input() deshabilitado = false;
  @Input() error: string | null = null;

  @Output() nueva = new EventEmitter<void>();
  @Output() seleccionada = new EventEmitter<number>();

  trackById(
    index: number,
    item: AiChatConversationSummary
  ): number {
    return item.id;
  }

  titulo(
    item: AiChatConversationSummary
  ): string {

    const titulo = item.title?.trim();

    if (
      titulo &&
      titulo !== 'Nueva conversación'
    ) {
      return titulo;
    }

    return `Conversación #${item.id}`;
  }


  subtitulo(
    item: AiChatConversationSummary
  ): string {

    const fuente = item.context_state?.source;

    const nombres: Record<string, string> = {
      incident_consolidated: 'Incidentes Consolidados',
      incident_sla: 'Incidentes SLA',
      requirement_consolidated: 'Requerimientos Consolidados',
      requirement_sla: 'Requerimientos SLA'
    };

    return fuente
      ? nombres[fuente] ?? fuente
      : 'Nueva conversación';
  }

}
