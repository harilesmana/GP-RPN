import { WebSocket } from "ws";
import { verifySession } from "../utils/session";
import { users, diskusi, type Diskusi } from "../db";

interface ConnectedUser {
  ws: WebSocket;
  userId: number;
  role: string;
  nama: string;
}

const connectedUsers = new Map<number, ConnectedUser>();

export function setupChatWebSocket(server: any) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws: WebSocket, request: any) => {
    
    const cookies = request.headers.cookie;
    const sessionCookie = cookies?.split(';')
      .find(c => c.trim().startsWith('session='))
      ?.split('=')[1];

    if (!sessionCookie) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
    const sessionData = verifySession(sessionCookie, secret);
    
    if (!sessionData) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const user = users.find(u => u.id === sessionData.userId);
    if (!user) {
      ws.close(1008, 'User not found');
      return;
    }

    
    connectedUsers.set(user.id, {
      ws,
      userId: user.id,
      role: user.role,
      nama: user.nama
    });

    console.log(`User ${user.nama} (${user.role}) connected to chat`);

    
    const recentDiscussions = diskusi.slice(-20); 
    ws.send(JSON.stringify({
      type: 'history',
      data: recentDiscussions.map(d => ({
        id: d.id,
        kelas: d.kelas,
        isi: d.isi,
        user_id: d.user_id,
        user_role: d.user_role,
        user_nama: users.find(u => u.id === d.user_id)?.nama || 'Anonim',
        created_at: d.created_at
      }))
    }));

    
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        
        if (message.type === 'chat') {
          const { kelas, isi } = message;
          
          if (!kelas || !isi || isi.trim().length < 1) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Kelas dan isi pesan harus diisi'
            }));
            return;
          }

          
          const newDiskusi: Diskusi = {
            id: diskusi.length + 1,
            kelas: kelas.trim(),
            isi: isi.trim(),
            user_id: user.id,
            user_role: user.role as any,
            created_at: new Date()
          };

          diskusi.push(newDiskusi);

          
          const broadcastMessage = JSON.stringify({
            type: 'chat',
            data: {
              id: newDiskusi.id,
              kelas: newDiskusi.kelas,
              isi: newDiskusi.isi,
              user_id: newDiskusi.user_id,
              user_role: newDiskusi.user_role,
              user_nama: user.nama,
              created_at: newDiskusi.created_at
            }
          });

          connectedUsers.forEach(connectedUser => {
            if (connectedUser.ws.readyState === WebSocket.OPEN) {
              connectedUser.ws.send(broadcastMessage);
            }
          });
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Format pesan tidak valid'
        }));
      }
    });

    
    ws.on('close', () => {
      connectedUsers.delete(user.id);
      console.log(`User ${user.nama} disconnected from chat`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedUsers.delete(user.id);
    });
  });

  return wss;
}
