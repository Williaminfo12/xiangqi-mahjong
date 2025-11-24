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

  // Initialize Peer
  public async init(): Promise<string> {
    this.close(); // Cleanup

    return new Promise((resolve, reject) => {
      this.peer = new Peer(); // Auto-generate ID from PeerJS server

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        console.log('My Peer ID:', id);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        // We generally don't reject here because 'error' can happen anytime, 
        // but for init, 'open' is the success criteria.
      });

      // Host Logic: Handle incoming connections
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });
    });
  }

  // Client: Connect to Host
  public connectToHost(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject('Peer not initialized');

      const conn = this.peer.connect(hostId);

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