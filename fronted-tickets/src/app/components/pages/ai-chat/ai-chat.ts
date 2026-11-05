
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { finalize, forkJoin, Subject, takeUntil } from 'rxjs';
import { AiChatContext, AiChatConversationSummary, AiChatMessageView, AiChatSendResponse } from '../../../models/ai-chat';
import { AiChatService } from '../../../services/ai-chat.service';

@Component({
  selector: 'app-ai-chat',
  standalone: false,
  templateUrl: './ai-chat.html',
  styleUrl: './ai-chat.css'
})
export class AiChat implements OnInit, OnDestroy {

  conversaciones: AiChatConversationSummary[] = [];
  conversacionId: number | null = null;
  contextoActivo: AiChatContext | null = null;

  mensajes: AiChatMessageView[] = [];
  borrador = '';

  cargandoConversaciones = false;
  cargandoConversacion = false;
  enviando = false;

  errorConversaciones: string | null = null;
  errorConversacion: string | null = null;
  errorEnvio: string | null = null;

  private readonly destroy$ = new Subject<void>();
  private solicitudConversacion = 0;
  private secuenciaLocal = 0;

  constructor(
    private chatService: AiChatService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarConversaciones();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get fuenteActual(): string {

    const source = this.contextoActivo?.source;

    const nombres: Record<string, string> = {
      incident_consolidated: 'Incidentes Consolidados',
      incident_sla: 'Incidentes SLA',
      requirement_consolidated: 'Requerimientos Consolidados',
      requirement_sla: 'Requerimientos SLA'
    };

    return source
      ? nombres[source] ?? source
      : 'Sin fuente seleccionada';
  }

  // =============================================
  // 1. LISTAR CONVERSACIONES
  // =============================================

  cargarConversaciones(): void {

    this.cargandoConversaciones = true;
    this.errorConversaciones = null;

    this.chatService.listarConversaciones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.conversaciones = data;
          this.cargandoConversaciones = false;
          this.changeDetector.markForCheck();
        },

        error: (error: HttpErrorResponse) => {
          this.errorConversaciones =
            this.obtenerError(
              error,
              'No se pudo cargar el historial.'
            );

          this.cargandoConversaciones = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  // =============================================
  // 2. NUEVA CONVERSACIÓN
  // =============================================

  nuevaConversacion(): void {

    if (this.enviando) return;

    this.solicitudConversacion++;

    this.conversacionId = null;
    this.contextoActivo = null;
    this.mensajes = [];
    this.borrador = '';

    this.cargandoConversacion = false;
    this.errorConversacion = null;
    this.errorEnvio = null;

    this.changeDetector.markForCheck();
  }

  // =============================================
  // 3. SELECCIONAR CONVERSACIÓN
  // =============================================

  seleccionarConversacion(id: number): void {

    if (this.enviando) return;

    const solicitud = ++this.solicitudConversacion;

    this.conversacionId = id;
    this.contextoActivo = null;
    this.mensajes = [];
    this.borrador = '';

    this.cargandoConversacion = true;
    this.errorConversacion = null;
    this.errorEnvio = null;

    forkJoin({
      conversacion: this.chatService.obtenerConversacion(id),
      mensajes: this.chatService.obtenerMensajes(id)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ conversacion, mensajes }) => {

          if (solicitud !== this.solicitudConversacion) {
            return;
          }

          this.contextoActivo = conversacion.context_state;

          this.mensajes = mensajes.map(mensaje => ({
            localId: `db-${mensaje.id}`,
            role: mensaje.role,
            content: mensaje.content,
            pending: false
          }));

          this.cargandoConversacion = false;
          this.changeDetector.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          if (solicitud !== this.solicitudConversacion) {
            return;
          }

          this.cargandoConversacion = false;

          this.errorConversacion = this.obtenerError(
            error,
            'No se pudo recuperar la conversación.'
          );

          this.changeDetector.markForCheck();
        }
      });
  }

  // =============================================
  // 4. ENVIAR MENSAJE
  // =============================================

  enviarMensaje(): void {

    const pregunta = this.borrador.trim();

    if (
      !pregunta ||
      this.enviando ||
      this.cargandoConversacion ||
      pregunta.length > 2000
    ) {
      return;
    }

    const idTemporal = this.nuevoIdLocal();
    const idConversacion = this.conversacionId;

    this.errorEnvio = null;
    this.enviando = true;

    // Mostrar inmediatamente la pregunta.
    this.mensajes = [
      ...this.mensajes,
      {
        localId: idTemporal,
        role: 'user',
        content: pregunta,
        pending: true
      }
    ];

    this.changeDetector.markForCheck();

    console.log('[CHAT IA] Enviando pregunta:', {
      conversation_id: idConversacion,
      pregunta
    });

    this.chatService
      .enviarMensaje(pregunta, idConversacion)
      .pipe(
        takeUntil(this.destroy$),

        // Se ejecuta cuando la petición
        // finaliza, falla o se cancela.
        finalize(() => {

          console.log(
            '[CHAT IA] Petición HTTP finalizada'
          );

          this.enviando = false;
          this.changeDetector.markForCheck();

        })
      )
      .subscribe({

        next: (respuesta: AiChatSendResponse) => {

          console.log(
            '[CHAT IA] Respuesta recibida:',
            respuesta
          );


          console.group('[CHAT IA] Diagnóstico analítico');

          console.log('Conversación:', respuesta.conversation_id);

          console.log('Estado:', respuesta.status);

          console.log('Fuente:', respuesta.source);

          console.log('Ruta utilizada:', respuesta.route);

          console.log('Contexto completo:');
          console.log(
            JSON.stringify(respuesta.context_state, null, 2)
          );

          console.log('Filtros activos:');
          console.table(respuesta.context_state?.filters ?? []);

          console.log('Persistido:', respuesta.persisted);

          console.groupEnd();


          try {

            if (
              !respuesta ||
              respuesta.persisted !== true ||
              !respuesta.answer ||
              !respuesta.conversation_id
            ) {

              console.warn(
                '[CHAT IA] Respuesta incompleta:',
                respuesta
              );

              this.revertirEnvio(
                idTemporal,
                'El servidor no confirmó la respuesta. Revisa el historial antes de reenviar.'
              );

              return;
            }

            // Actualizar conversación activa.
            this.conversacionId =
              respuesta.conversation_id;

            this.contextoActivo =
              respuesta.context_state;

            // Confirmar pregunta y agregar respuesta.
            this.mensajes = [
              ...this.mensajes.map(mensaje =>
                mensaje.localId === idTemporal
                  ? {
                    ...mensaje,
                    pending: false
                  }
                  : mensaje
              ),
              {
                localId: this.nuevoIdLocal(),
                role: 'assistant',
                content: respuesta.answer,
                pending: false
              }
            ];

            // Limpiar el campo de entrada.
            this.borrador = '';
            this.errorEnvio = null;
            this.enviando = false;

            console.log(
              '[CHAT IA] Mensajes actualizados:',
              this.mensajes.length
            );

            // Refrescar historial lateral.
            this.cargarConversaciones();

            // Forzar actualización visual.
            this.changeDetector.detectChanges();

          } catch (error) {

            console.error(
              '[CHAT IA] Error mostrando respuesta:',
              error
            );

            this.mensajes = this.mensajes.filter(
              mensaje =>
                mensaje.localId !== idTemporal
            );

            this.errorEnvio =
              'El servidor respondió, pero hubo un error al mostrar el resultado. Recarga el historial antes de reenviar.';

            this.changeDetector.markForCheck();
          }
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            '[CHAT IA] Error de petición HTTP:',
            error
          );

          this.revertirEnvio(
            idTemporal,
            this.obtenerError(
              error,
              'No se recibió correctamente la respuesta. Consulta el historial antes de volver a enviar.'
            )
          );
        }
      });
  }

  // =============================================
  // 5. CONSULTAS DE EJEMPLO
  // =============================================

  usarSugerencia(pregunta: string): void {
    this.borrador = pregunta;
    this.enviarMensaje();
  }

  // =============================================
  // 6. ACCIONES AUXILIARES
  // =============================================

  refrescar(): void {

    if (this.enviando) return;

    this.cargarConversaciones();

    if (this.conversacionId !== null) {
      this.seleccionarConversacion(this.conversacionId);
    }
  }

  private revertirEnvio(
    idTemporal: string,
    mensajeError: string
  ): void {

    this.mensajes = this.mensajes.filter(
      mensaje => mensaje.localId !== idTemporal
    );

    // El borrador permanece para volver a enviarlo.
    this.errorEnvio = mensajeError;
    this.enviando = false;

    this.changeDetector.markForCheck();
  }

  private nuevoIdLocal(): string {
    this.secuenciaLocal++;
    return `local-${this.secuenciaLocal}`;
  }


  private obtenerError(
    error: HttpErrorResponse,
    mensajePredeterminado: string
  ): string {

    const detalle = error.error?.detail;

    if (
      typeof detalle === 'string' &&
      detalle.trim()
    ) {
      return detalle;
    }

    if (
      detalle &&
      typeof detalle === 'object' &&
      typeof detalle.message === 'string' &&
      detalle.message.trim()
    ) {
      return detalle.message;
    }

    return mensajePredeterminado;
  }

}
