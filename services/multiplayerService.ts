
import { NetworkMessage, NetworkActionType } from '../types';

class MultiplayerService {
  private channel: BroadcastChannel;
  private onMessageCallback: ((msg: NetworkMessage) => void) | null = null;

  constructor() {
    this.channel = new BroadcastChannel('xiangqi_mahjong_channel');
    this.channel.onmessage = (event) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(event.data as NetworkMessage);
      }
    };
  }

  public setOnMessage(callback: (msg: NetworkMessage) => void) {
    this.onMessageCallback = callback;
  }

  public send(type: NetworkActionType, payload: any = {}, senderId?: number) {
    const msg: NetworkMessage = { type, payload, senderId };
    this.channel.postMessage(msg);
  }

  public close() {
    this.channel.close();
  }
}

const multiplayerService = new MultiplayerService();
export default multiplayerService;
