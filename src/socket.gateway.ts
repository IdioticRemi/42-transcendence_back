import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsResponse,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'net';

@WebSocketGateway({ cors: true })
export class SocketGateway {
  @SubscribeMessage('ping')
  handleEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: string,
  ): WsResponse<string> {
    Logger.debug(`Recieved ping: ${data}`);
    return {
      event: 'pong',
      data: `Hello world from server! Recieved: ${data}`,
    };
  }
}
