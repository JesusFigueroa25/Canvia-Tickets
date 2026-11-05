
import {
  Component,
  Input,
  Output,
  EventEmitter
} from '@angular/core';

@Component({
  selector: 'app-ai-chat-composer',
  standalone: false,
  templateUrl: './ai-chat-composer.html',
  styleUrl: './ai-chat-composer.css'
})
export class AiChatComposer {

  @Input() valor: string = '';
  @Input() deshabilitado: boolean = false;

  @Output() valorChange = new EventEmitter<string>();
  @Output() enviar = new EventEmitter<void>();


  // ============================================
  // ACTUALIZAR TEXTO DEL MENSAJE
  // ============================================

  actualizarValor(event: Event): void {

    const textarea = event.target as HTMLTextAreaElement;

    this.valorChange.emit(textarea.value);
  }


  // ============================================
  // ENVIAR MENSAJE CON ENTER
  // SHIFT + ENTER: SALTO DE LÍNEA
  // ============================================

  manejarEnter(event: Event): void {

    const teclado = event as KeyboardEvent;

    if (
      teclado.shiftKey ||
      teclado.isComposing
    ) {
      return;
    }

    teclado.preventDefault();

    if (this.puedeEnviar) {
      this.enviar.emit();
    }
  }

  // VALIDAR ENVÍO
  get puedeEnviar(): boolean {

    return (
      !this.deshabilitado &&
      this.valor.trim().length > 0 &&
      this.valor.trim().length <= 2000
    );
  }
}
