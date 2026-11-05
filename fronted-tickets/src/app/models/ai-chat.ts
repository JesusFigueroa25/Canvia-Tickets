
/* ================================================
   CANVIA - CHATBOT ANALÍTICO IA
   MODELOS COMPATIBLES CON FASTAPI
   ================================================ */

export type AiChatRole = 'user' | 'assistant';

export type AiChatStatus =
  | 'success'
  | 'needs_clarification'
  | 'unsupported';

export type AiChatResponseType = 'text';


/* ================================================
   CONTEXTO
   ================================================ */

export interface AiChatFilter {
  field: string;
  operator: string;
  value: unknown;
}

export interface AiChatContext {
  version: number;
  source: string | null;
  date_field: string | null;
  filters: AiChatFilter[];
}


/* ================================================
   1. ENVIAR MENSAJE
   ================================================ */

export interface AiChatSendRequest {
  pregunta: string;
  conversation_id: number | null;
}

export interface AiChatSendResponse {
  status: AiChatStatus;
  conversation_id: number;
  response_type: AiChatResponseType;
  answer: string;
  context_state: AiChatContext;
  source: string | null;
  route: string | null;
  generation_mode: string | null;
  metrics: Record<string, unknown>;
  executed: boolean;
  persisted: boolean;
}


/* ================================================
   2. LISTAR CONVERSACIONES
   ================================================ */

export interface AiChatConversationSummary {
  id: number;
  title: string;
  context_state: AiChatContext;
}

export interface AiChatConversationListResponse {
  conversations: AiChatConversationSummary[];
  limit: number;
  offset: number;
}


/* ================================================
   3. OBTENER CONVERSACIÓN POR ID
   ================================================ */

export interface AiChatConversationDetail {
  id: number;
  title: string;
  context_state: AiChatContext;
}


/* ================================================
   4. OBTENER HISTORIAL DE MENSAJES
   ================================================ */

export interface AiChatMessage {
  id: number;
  role: AiChatRole;
  content: string;
  response_type: string | null;
  source: string | null;
}

export interface AiChatHistoryResponse {
  conversation_id: number;
  messages: AiChatMessage[];
  limit: number;
  offset: number;
}


/* ================================================
   MODELO PARA LA INTERFAZ
   ================================================ */

export interface AiChatMessageView {
  localId: string;
  role: AiChatRole;
  content: string;
  pending?: boolean;
}
