import { ElysiaWS } from "elysia/ws";
import { users, kelas, roomDiskusiKelas, diskusiKelas, diskusiMateri } from "../db";

export interface WebSocketData {
  userId: number;
  userRole: string;
  userName: string;
  roomId?: number;
  materiId?: number;
}

export class DiskusiWebSocketHandler {
  private connections: Map<number, Set<ElysiaWS<any, WebSocketData>>> = new Map();
  private userConnections: Map<number, ElysiaWS<any, WebSocketData>[]> = new Map();

  // Room Diskusi
  public handleRoomConnection(ws: ElysiaWS<any, WebSocketData>, data: WebSocketData) {
    if (!data.roomId) return;

    const roomId = data.roomId;
    
    // Simpan koneksi user
    if (!this.userConnections.has(data.userId)) {
      this.userConnections.set(data.userId, []);
    }
    this.userConnections.get(data.userId)!.push(ws);

    // Simpan koneksi room
    if (!this.connections.has(roomId)) {
      this.connections.set(roomId, new Set());
    }
    this.connections.get(roomId)!.add(ws);

    // Kirim riwayat diskusi saat pertama kali connect
    this.sendRoomHistory(ws, roomId);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleRoomMessage(ws, roomId, data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      this.connections.get(roomId)?.delete(ws);
      const userConns = this.userConnections.get(data.userId);
      if (userConns) {
        const index = userConns.indexOf(ws);
        if (index > -1) {
          userConns.splice(index, 1);
        }
        if (userConns.length === 0) {
          this.userConnections.delete(data.userId);
        }
      }
    });
  }

  // Materi Diskusi
  public handleMateriConnection(ws: ElysiaWS<any, WebSocketData>, data: WebSocketData) {
    if (!data.materiId) return;

    const materiId = data.materiId;
    
    // Simpan koneksi user
    if (!this.userConnections.has(data.userId)) {
      this.userConnections.set(data.userId, []);
    }
    this.userConnections.get(data.userId)!.push(ws);

    // Simpan koneksi materi (gunakan negative ID untuk materi)
    const connectionKey = -materiId;
    if (!this.connections.has(connectionKey)) {
      this.connections.set(connectionKey, new Set());
    }
    this.connections.get(connectionKey)!.add(ws);

    // Kirim riwayat diskusi
    this.sendMateriHistory(ws, materiId);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleMateriMessage(ws, materiId, data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      this.connections.get(connectionKey)?.delete(ws);
      const userConns = this.userConnections.get(data.userId);
      if (userConns) {
        const index = userConns.indexOf(ws);
        if (index > -1) {
          userConns.splice(index, 1);
        }
        if (userConns.length === 0) {
          this.userConnections.delete(data.userId);
        }
      }
    });
  }

  private async handleRoomMessage(ws: ElysiaWS<any, WebSocketData>, roomId: number, data: any) {
    const userData = ws.data;
    
    if (data.type === 'message' && data.content) {
      // Simpan ke database
      const newDiskusi: any = {
        id: diskusiKelas.length + 1,
        room_id: roomId,
        user_id: userData.userId,
        user_role: userData.userRole,
        isi: data.content.trim(),
        created_at: new Date()
      };

      diskusiKelas.push(newDiskusi);

      // Broadcast ke semua user di room yang sama
      const message = JSON.stringify({
        type: 'new_message',
        data: {
          id: newDiskusi.id,
          user_id: userData.userId,
          user_name: userData.userName,
          user_role: userData.userRole,
          content: data.content,
          timestamp: newDiskusi.created_at.toISOString()
        }
      });

      this.broadcastToRoom(roomId, message);
    }
  }

  private async handleMateriMessage(ws: ElysiaWS<any, WebSocketData>, materiId: number, data: any) {
    const userData = ws.data;
    
    if (data.type === 'message' && data.content) {
      // Simpan ke database
      const newDiskusi: any = {
        id: diskusiMateri.length + 1,
        materi_id: materiId,
        user_id: userData.userId,
        user_role: userData.userRole,
        isi: data.content.trim(),
        created_at: new Date()
      };

      diskusiMateri.push(newDiskusi);

      // Broadcast ke semua user di materi yang sama
      const message = JSON.stringify({
        type: 'new_message',
        data: {
          id: newDiskusi.id,
          user_id: userData.userId,
          user_name: userData.userName,
          user_role: userData.userRole,
          content: data.content,
          timestamp: newDiskusi.created_at.toISOString()
        }
      });

      this.broadcastToMateri(materiId, message);
    }
  }

  private async sendRoomHistory(ws: ElysiaWS<any, WebSocketData>, roomId: number) {
    const history = diskusiKelas
      .filter(d => d.room_id === roomId)
      .slice(-50) // Ambil 50 pesan terakhir
      .map(d => {
        const user = users.find(u => u.id === d.user_id);
        return {
          id: d.id,
          user_id: d.user_id,
          user_name: user?.nama || 'Anonim',
          user_role: d.user_role,
          content: d.isi,
          timestamp: d.created_at.toISOString()
        };
      });

    ws.send(JSON.stringify({
      type: 'history',
      data: history
    }));
  }

  private async sendMateriHistory(ws: ElysiaWS<any, WebSocketData>, materiId: number) {
    const history = diskusiMateri
      .filter(d => d.materi_id === materiId)
      .slice(-50)
      .map(d => {
        const user = users.find(u => u.id === d.user_id);
        return {
          id: d.id,
          user_id: d.user_id,
          user_name: user?.nama || 'Anonim',
          user_role: d.user_role,
          content: d.isi,
          timestamp: d.created_at.toISOString()
        };
      });

    ws.send(JSON.stringify({
      type: 'history',
      data: history
    }));
  }

  private broadcastToRoom(roomId: number, message: string) {
    const roomConnections = this.connections.get(roomId);
    if (roomConnections) {
      roomConnections.forEach(ws => {
        if (ws.readyState === 1) { // 1 = OPEN
          ws.send(message);
        }
      });
    }
  }

  private broadcastToMateri(materiId: number, message: string) {
    const connectionKey = -materiId;
    const materiConnections = this.connections.get(connectionKey);
    if (materiConnections) {
      materiConnections.forEach(ws => {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      });
    }
  }
}

export const diskusiHandler = new DiskusiWebSocketHandler();