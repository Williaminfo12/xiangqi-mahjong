import Peer, { DataConnection } from 'peerjs';
import { NetworkMessage, NetworkActionType } from '../types';

class MultiplayerService {
  private peer: Peer | null = null;
  // Host stores connections to Clients (PeerID -> Connection)
  private connections: Map<string, DataConnection> = new Map(); 
  // Client stores connection to Host
  private hostConnection: DataConnection | null = null; 
  
  private onMessageCallback: ((msg: NetworkMessage) => void) | null = null;
  private hostMessageHandler: ((msg: NetworkMessage, peerId: string) => void) | null = null;

  public myPeerId: string | null = null;

  // Generate a readable 5-char ID (No I, 1, O, 0 to avoid confusion)
  private generateShortId(): string {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let result = '';
      for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
  }

  // Initialize Peer
  // customId: Optional specific ID requested by user
  // requestShortId: If no customId, true tries to generate a 5-char random ID, false gives UUID
  public async init(customId?: string, requestShortId: boolean = false): Promise<string> {
    this.close(); // Cleanup

    return new Promise((resolve, reject) => {
      
      const tryInit = () => {
          // Priority: Custom ID -> Random Short ID -> Undefined (Auto UUID)
          const idToUse = customId || (requestShortId ? this.generateShortId() : undefined);
          
          const peer = new Peer(idToUse); 

          peer.on('open', (assignedId) => {
            this.peer = peer;
            this.myPeerId = assignedId;
            console.log('My Peer ID:', assignedId);
            resolve(assignedId);
          });

          peer.on('error', (err: any) => {
            console.warn('Peer error:', err.type);
            
            if (err.type === 'unavailable-id' || err.type === 'peer-unavailable') {
                if (customId) {
                    // If user manually set an ID and it's taken, reject immediately so UI can tell them
                    console.error("Custom ID collision");
                    peer.destroy();
                    reject('ID_TAKEN');
                } else if (requestShortId) {
                    // If we are generating random short IDs and hit a collision, retry automatically
                    console.log("Random ID Collision, retrying...");
                    peer.destroy();
                    tryInit(); 
                } else {
                   if (!this.peer) reject(err);
                }
            } else {
                // Real error (network, etc)
                if (!this.peer) reject(err);
            }
          });

          // Host Logic: Handle incoming connections
          peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
          });
      };

      tryInit();
    });
  }

  // Client: Connect to Host
  public connectToHost(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject('Peer not initialized');

      // Ensure UpperCase for ID match
      const conn = this.peer.connect(hostId.toUpperCase());

      conn.on('open', () => {
        this.hostConnection = conn;
        this.setupConnectionEvents(conn);
        resolve();
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        reject(err);
      });
    });
  }

  // Host: Setup new connection
  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
        console.log("Client connected:", conn.peer);
        this.connections.set(conn.peer, conn);
        this.setupConnectionEvents(conn);
    });
  }

  // Setup listeners for data
  private setupConnectionEvents(conn: DataConnection) {
    conn.on('data', (data) => {
      const msg = data as NetworkMessage;
      
      // If I am Host, I pass the sender's PeerID to the handler
      if (this.hostMessageHandler) {
          this.hostMessageHandler(msg, conn.peer);
      }

      // General callback
      if (this.onMessageCallback) {
        this.onMessageCallback(msg);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
    });
    
    conn.on('error', (e) => console.error("Conn error", e));
  }

  public setOnMessage(callback: (msg: NetworkMessage) => void) {
    this.onMessageCallback = callback;
  }
  
  public setHostMessageHandler(callback: (msg: NetworkMessage, peerId: string) => void) {
      this.hostMessageHandler = callback;
  }

  // Send Logic
  public send(type: NetworkActionType, payload: any = {}, senderId?: number) {
    const msg: NetworkMessage = { type, payload, senderId };

    if (this.hostConnection) {
      // Client -> Host
      if (this.hostConnection.open) this.hostConnection.send(msg);
    } else {
      // Host -> Broadcast to All Clients
      this.connections.forEach(conn => {
        if (conn.open) conn.send(msg);
      });
    }
  }
  
  // Host: Send to specific Peer (for Handshake)
  public sendToPeer(peerId: string, type: NetworkActionType, payload: any = {}) {
      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
          conn.send({ type, payload });
      }
  }

  public close() {
    this.peer?.destroy();
    this.peer = null;
    this.connections.clear();
    this.hostConnection = null;
    this.myPeerId = null;
    this.onMessageCallback = null;
    this.hostMessageHandler = null;
  }
}

const multiplayerService = new MultiplayerService();
export default multiplayerService;