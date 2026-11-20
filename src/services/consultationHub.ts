import * as signalR from '@microsoft/signalr';
import { storageHelper } from '../api/apiClient';
import { config, getLocalApiBaseUrl } from '../constants/config';
import type { ConsultationMessageDto, MessagesReadEvent, UserTypingEvent } from '../types/consultation';

export interface ConsultationHubHandlers {
  onMessage: (msg: ConsultationMessageDto) => void;
  onTyping: (evt: UserTypingEvent) => void;
  onMessagesRead: (evt: MessagesReadEvent) => void;
  /** SessionStarted / SessionCompleted: trạng thái ca đổi → màn hình tải lại */
  onSessionChanged: () => void;
}

export interface ConsultationHubConnection {
  sendTyping: (isTyping: boolean) => void;
  stop: () => Promise<void>;
}

/** Mở kết nối tới /hubs/consultation và vào nhóm Booking_{bookingId}. Mỗi màn chat giữ một kết nối riêng. */
export async function connectConsultationHub(
  bookingId: string,
  handlers: ConsultationHubHandlers
): Promise<ConsultationHubConnection> {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${getLocalApiBaseUrl()}/hubs/consultation`, {
      // BE đọc token từ query access_token cho đường dẫn /hubs
      accessTokenFactory: async () => (await storageHelper.getItem(config.storageKeys.accessToken)) ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on('ReceiveChatMessage', handlers.onMessage);
  connection.on('UserTyping', handlers.onTyping);
  // BE phát cả "MessagesRead" lẫn "ReceiveMessagesRead" cùng nội dung → chỉ nghe một tên
  connection.on('MessagesRead', handlers.onMessagesRead);
  connection.on('SessionStarted', handlers.onSessionChanged);
  connection.on('SessionCompleted', handlers.onSessionChanged);
  // Mất kết nối rồi nối lại: phải vào lại nhóm và tải lại tin đã lỡ
  connection.onreconnected(async () => {
    await connection.invoke('JoinConsultationRoom', bookingId).catch(() => {});
    handlers.onSessionChanged();
  });

  await connection.start();
  await connection.invoke('JoinConsultationRoom', bookingId);

  return {
    sendTyping: (isTyping) => {
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke('SendTypingIndicator', bookingId, isTyping).catch(() => {});
      }
    },
    stop: async () => {
      try {
        if (connection.state === signalR.HubConnectionState.Connected) {
          await connection.invoke('LeaveConsultationRoom', bookingId);
        }
      } catch {}
      await connection.stop();
    },
  };
}
