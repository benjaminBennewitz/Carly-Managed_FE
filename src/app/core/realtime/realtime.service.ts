// src/app/core/realtime/realtime.service.ts

import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { getWebSocketBaseUrl } from '../api/api.config';
import { RealtimeEnvelope } from './realtime.models';

const HEARTBEAT_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 750;
const RECONNECT_MAX_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private boardSocket: WebSocket | null = null;
  private inboxSocket: WebSocket | null = null;
  private boardId: string | null = null;
  private boardReconnectAttempt = 0;
  private inboxReconnectAttempt = 0;
  private boardReconnectTimer: number | null = null;
  private inboxReconnectTimer: number | null = null;
  private boardHeartbeatTimer: number | null = null;
  private inboxHeartbeatTimer: number | null = null;
  private boardGeneration = 0;
  private activeEditingTaskId: string | null = null;
  private inboxEnabled = false;
  private readonly boardEventsState = new Subject<RealtimeEnvelope>();
  private readonly inboxEventsState = new Subject<RealtimeEnvelope>();
  private readonly boardConnectedState = signal(false);
  private readonly inboxConnectedState = signal(false);

  readonly boardEvents = this.boardEventsState.asObservable();
  readonly inboxEvents = this.inboxEventsState.asObservable();
  readonly boardConnected = this.boardConnectedState.asReadonly();
  readonly inboxConnected = this.inboxConnectedState.asReadonly();

  /** Verbindet genau ein aktives Board und ersetzt einen vorherigen Boardkanal. */
  connectBoard(boardId: string): void {
    if (this.boardId === boardId && this.boardSocket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnectBoard();
    this.boardId = boardId;
    this.boardGeneration += 1;
    this.openBoardSocket(boardId, this.boardGeneration);
  }

  /** Trennt den aktiven Boardkanal inklusive Heartbeat und Reconnect. */
  disconnectBoard(): void {
    this.boardGeneration += 1;
    this.boardId = null;
    this.activeEditingTaskId = null;
    this.boardConnectedState.set(false);
    this.clearTimer('boardReconnect');
    this.clearTimer('boardHeartbeat');
    if (this.boardSocket) {
      this.detachSocketHandlers(this.boardSocket);
      this.boardSocket.close(1000, 'board_changed');
      this.boardSocket = null;
    }
  }

  /** Baut den persönlichen Inboxkanal auf und hält ihn während der App-Sitzung offen. */
  connectInbox(): void {
    this.inboxEnabled = true;
    if (
      this.inboxSocket?.readyState === WebSocket.OPEN ||
      this.inboxSocket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    this.openInboxSocket();
  }

  /** Trennt den persönlichen Inboxkanal vollständig. */
  disconnectInbox(): void {
    this.inboxEnabled = false;
    this.inboxConnectedState.set(false);
    this.clearTimer('inboxReconnect');
    this.clearTimer('inboxHeartbeat');
    if (this.inboxSocket) {
      this.detachSocketHandlers(this.inboxSocket);
      this.inboxSocket.close(1000, 'session_ended');
      this.inboxSocket = null;
    }
  }

  /** Sendet eine normierte Mausposition an das aktuell verbundene Board. */
  sendCursor(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.sendBoard({
      type: 'cursor.move',
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  }

  /** Meldet Beginn oder Ende einer Taskbearbeitung. */
  sendEditing(taskId: string | null, active: boolean): void {
    if (active && taskId) {
      this.activeEditingTaskId = taskId;
    } else if (!taskId || this.activeEditingTaskId === taskId) {
      this.activeEditingTaskId = null;
    }
    this.sendBoard({ type: 'editing.changed', taskId, active });
  }

  /** Startet eine serverseitig validierte kooperative Carly-Aktion. */
  sendCooperativeAction(action: 'high_five' | 'focus_start'): void {
    this.sendBoard({ type: 'carly.coop', action });
  }

  /** Öffnet einen Board-WebSocket mit generationssicherem Reconnect. */
  private openBoardSocket(boardId: string, generation: number): void {
    if (typeof WebSocket === 'undefined' || generation !== this.boardGeneration) return;

    const socket = new WebSocket(`${getWebSocketBaseUrl()}/v1/boards/${boardId}/`);
    this.boardSocket = socket;

    socket.onopen = () => {
      if (generation !== this.boardGeneration) return;
      this.boardReconnectAttempt = 0;
      this.boardConnectedState.set(true);
      this.startBoardHeartbeat(generation);
      if (this.activeEditingTaskId) {
        this.sendBoard({
          type: 'editing.changed',
          taskId: this.activeEditingTaskId,
          active: true,
        });
      }
    };
    socket.onmessage = (event) => this.forwardMessage(event, this.boardEventsState);
    socket.onerror = () => socket.close();
    socket.onclose = (event) => {
      if (generation !== this.boardGeneration) return;
      if (this.boardSocket === socket) this.boardSocket = null;
      this.boardConnectedState.set(false);
      this.clearTimer('boardHeartbeat');
      if (event.code === 4401 || event.code === 4403 || !this.boardId) return;
      this.scheduleBoardReconnect(boardId, generation);
    };
  }

  /** Öffnet den Inbox-WebSocket und stellt ihn nach Netzwerkabbrüchen wieder her. */
  private openInboxSocket(): void {
    if (typeof WebSocket === 'undefined' || !this.inboxEnabled) return;

    const socket = new WebSocket(`${getWebSocketBaseUrl()}/v1/inbox/`);
    this.inboxSocket = socket;
    socket.onopen = () => {
      this.inboxReconnectAttempt = 0;
      this.inboxConnectedState.set(true);
      this.startInboxHeartbeat();
    };
    socket.onmessage = (event) => this.forwardMessage(event, this.inboxEventsState);
    socket.onerror = () => socket.close();
    socket.onclose = (event) => {
      if (this.inboxSocket === socket) this.inboxSocket = null;
      this.inboxConnectedState.set(false);
      this.clearTimer('inboxHeartbeat');
      if (event.code === 4401 || !this.inboxEnabled) return;
      this.scheduleInboxReconnect();
    };
  }

  /** Leitet ausschließlich valide JSON-Objekte an die jeweilige Ereignisquelle weiter. */
  private forwardMessage(event: MessageEvent<string>, target: Subject<RealtimeEnvelope>): void {
    try {
      const value = JSON.parse(event.data) as unknown;
      if (value && typeof value === 'object' && 'type' in value) {
        target.next(value as RealtimeEnvelope);
      }
    } catch {
      return;
    }
  }

  /** Sendet nur bei einer tatsächlich offenen Boardverbindung. */
  private sendBoard(payload: Record<string, unknown>): void {
    if (this.boardSocket?.readyState !== WebSocket.OPEN) return;
    this.boardSocket.send(JSON.stringify(payload));
  }

  /** Plant einen begrenzten exponentiellen Reconnect für den Boardkanal. */
  private scheduleBoardReconnect(boardId: string, generation: number): void {
    this.clearTimer('boardReconnect');
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.boardReconnectAttempt,
    );
    this.boardReconnectAttempt += 1;
    this.boardReconnectTimer = window.setTimeout(() => {
      if (this.boardId === boardId && generation === this.boardGeneration) {
        this.openBoardSocket(boardId, generation);
      }
    }, delay);
  }

  /** Plant einen begrenzten exponentiellen Reconnect für den Inboxkanal. */
  private scheduleInboxReconnect(): void {
    this.clearTimer('inboxReconnect');
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.inboxReconnectAttempt,
    );
    this.inboxReconnectAttempt += 1;
    this.inboxReconnectTimer = window.setTimeout(() => this.openInboxSocket(), delay);
  }

  /** Hält Presence-Zustand und Proxys mit einem sparsamen Heartbeat aktiv. */
  private startBoardHeartbeat(generation: number): void {
    this.clearTimer('boardHeartbeat');
    this.boardHeartbeatTimer = window.setInterval(() => {
      if (generation === this.boardGeneration) this.sendBoard({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Hält den persönlichen Inboxkanal aktiv. */
  private startInboxHeartbeat(): void {
    this.clearTimer('inboxHeartbeat');
    this.inboxHeartbeatTimer = window.setInterval(() => {
      if (this.inboxSocket?.readyState === WebSocket.OPEN) {
        this.inboxSocket.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Entfernt Handler eines bewusst geschlossenen Sockets gegen späte Alt-Ereignisse. */
  private detachSocketHandlers(socket: WebSocket): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  /** Entfernt einen der vier internen Timer ohne doppelten Cleanup-Code. */
  private clearTimer(
    kind: 'boardReconnect' | 'inboxReconnect' | 'boardHeartbeat' | 'inboxHeartbeat',
  ): void {
    const timer =
      kind === 'boardReconnect'
        ? this.boardReconnectTimer
        : kind === 'inboxReconnect'
          ? this.inboxReconnectTimer
          : kind === 'boardHeartbeat'
            ? this.boardHeartbeatTimer
            : this.inboxHeartbeatTimer;
    if (timer !== null) {
      if (kind === 'boardHeartbeat' || kind === 'inboxHeartbeat') {
        window.clearInterval(timer);
      } else {
        window.clearTimeout(timer);
      }
    }
    if (kind === 'boardReconnect') this.boardReconnectTimer = null;
    if (kind === 'inboxReconnect') this.inboxReconnectTimer = null;
    if (kind === 'boardHeartbeat') this.boardHeartbeatTimer = null;
    if (kind === 'inboxHeartbeat') this.inboxHeartbeatTimer = null;
  }
}
