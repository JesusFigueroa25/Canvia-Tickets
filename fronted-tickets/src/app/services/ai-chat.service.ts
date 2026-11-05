
import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  EMPTY,
  Observable,
  expand,
  reduce
} from 'rxjs';

import {
  AiChatSendRequest,
  AiChatSendResponse,
  AiChatConversationSummary,
  AiChatConversationDetail,
  AiChatConversationListResponse,
  AiChatMessage,
  AiChatHistoryResponse
} from '../models/ai-chat';


@Injectable({
  providedIn: 'root'
})
export class AiChatService {

  private readonly servidor = 'api';
  private readonly recurso = 'ai-chat';

  private readonly endpoint =
    `${this.servidor}/${this.recurso}`;

  private readonly tamanioPagina = 100;

  constructor(
    private http: HttpClient
  ) { }


  // =============================================
  // 1. ENVIAR MENSAJE AL CHATBOT
  // POST /messages
  // =============================================

  enviarMensaje(
    pregunta: string,
    conversationId: number | null
  ): Observable<AiChatSendResponse> {

    const body: AiChatSendRequest = {
      pregunta,
      conversation_id: conversationId
    };

    return this.http.post<AiChatSendResponse>(
      `${this.endpoint}/messages`,
      body
    );
  }


  // =============================================
  // 2. LISTAR CONVERSACIONES
  // GET /conversations
  // =============================================

  private obtenerPaginaConversaciones(
    offset: number
  ): Observable<AiChatConversationListResponse> {

    const params = new HttpParams()
      .set('limit', this.tamanioPagina)
      .set('offset', offset);

    return this.http.get<AiChatConversationListResponse>(
      `${this.endpoint}/conversations`,
      { params }
    );
  }

  listarConversaciones():
    Observable<AiChatConversationSummary[]> {

    return this.obtenerPaginaConversaciones(0).pipe(

      expand(pagina => {

        if (
          pagina.conversations.length <
          pagina.limit
        ) {
          return EMPTY;
        }

        return this.obtenerPaginaConversaciones(
          pagina.offset + pagina.limit
        );
      }),

      reduce(
        (acumulado, pagina) => [
          ...acumulado,
          ...pagina.conversations
        ],
        [] as AiChatConversationSummary[]
      )

    );
  }


  // =============================================
  // 3. OBTENER CONVERSACIÓN POR ID
  // GET /conversations/{conversation_id}
  // =============================================

  obtenerConversacion(
    conversationId: number
  ): Observable<AiChatConversationDetail> {

    return this.http.get<AiChatConversationDetail>(
      `${this.endpoint}/conversations/${conversationId}`
    );
  }


  // =============================================
  // 4. OBTENER HISTORIAL DE MENSAJES
  // GET /conversations/{conversation_id}/messages
  // =============================================

  private obtenerPaginaMensajes(
    conversationId: number,
    offset: number
  ): Observable<AiChatHistoryResponse> {

    const params = new HttpParams()
      .set('limit', this.tamanioPagina)
      .set('offset', offset);

    return this.http.get<AiChatHistoryResponse>(
      `${this.endpoint}/conversations/${conversationId}/messages`,
      { params }
    );
  }

  obtenerMensajes(
    conversationId: number
  ): Observable<AiChatMessage[]> {

    return this.obtenerPaginaMensajes(
      conversationId,
      0
    ).pipe(

      expand(pagina => {

        if (
          pagina.messages.length <
          pagina.limit
        ) {
          return EMPTY;
        }

        return this.obtenerPaginaMensajes(
          conversationId,
          pagina.offset + pagina.limit
        );
      }),

      reduce(
        (acumulado, pagina) => [
          ...acumulado,
          ...pagina.messages
        ],
        [] as AiChatMessage[]
      )

    );
  }

}
