import { WebSocketServer, WebSocket } from "ws";
import { verifySession } from "../utils/session";
import { users, diskusi, type Diskusi } from "../db";

interface ConnectedUser {
  ws: WebSocket;
  userId: number;
  role: string;
  nama: string;
  lastActivity: Date;
}

const connectedUsers = new Map<number, ConnectedUser>();

export function setupChatWebSocket() {
  const WS_PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 3001;
  
  const wss = new WebSocketServer({ 
    port: WS_PORT,
    
    verifyClient: (info, callback) => {
      console.log('Client connecting from:', info.origin);
      callback(true); 
    }
  });
  
  console.log(`WebSocket server running on port ${WS_PORT}`);

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('New WebSocket connection attempt');
    
    
    const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
    const token = url?.searchParams.get('token');
    
    
    let user = null;
    let authenticated = false;
    
    if (token) {
      try {
        const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
        const data = verifySession(token, secret);
        
        if (data) {
          user = users.find(u => u.id === data.userId);
          if (user) {
            authenticated = true;
          }
        }
      } catch (error) {
        console.error('Auth error:', error);
      }
    }
    
    if (!authenticated) {
      console.log('Unauthenticated connection, allowing for testing');
      
      user = users.find(u => u.role === 'kepsek') || users[0];
      if (user) authenticated = true;
    }
    
    if (!authenticated || !user) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Authentication failed'
      }));
      ws.close();
      return;
    }
    
    
    connectedUsers.set(user.id, { 
      ws, 
      userId: user.id, 
      role: user.role, 
      nama: user.nama,
      lastActivity: new Date()
    });
    
    console.log(`User ${user.nama} connected to WebSocket`);
    
    
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to chat server successfully',
      user: {
        id: user.id,
        nama: user.nama,
        role: user.role
      },
      timestamp: new Date().toISOString()
    }));
    
    
    const onlineUsers = Array.from(connectedUsers.values()).map(u => ({
      id: u.userId,
      nama: u.nama,
      role: u.role
    }));
    
    ws.send(JSON.stringify({
      type: 'online_users',
      data: onlineUsers
    }));
    
    
    const roomMessages = diskusi
      .filter(d => d.kelas === 'Kelas 1A')
      .slice(-20)
      .map(msg => ({
        ...msg,
        user_nama: users.find(u => u.id === msg.user_id)?.nama || 'Unknown',
        formatted_time: new Date(msg.created_at).toLocaleTimeString()
      }));
    
    ws.send(JSON.stringify({
      type: 'history',
      data: roomMessages
    }));
    
    
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        if (data.type === 'chat') {
          const newDiskusi: Diskusi = {
            id: Date.now(), 
            kelas: data.kelas || currentChatRoom,
            isi: data.isi,
            user_id: user.id,
            user_role: user.role as any,
            created_at: new Date()
          };
          
          diskusi.push(newDiskusi);
          
          
          const broadcastData = {
            type: 'chat',
            data: {
              ...newDiskusi,
              user_nama: user.nama,
              user_role: user.role,
              formatted_time: new Date().toLocaleTimeString()
            }
          };
          
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(broadcastData));
            }
          });
        }
        
        if (data.type === 'history_request') {
          const roomMessages = diskusi
            .filter(d => d.kelas === (data.kelas || 'Kelas 1A'))
            .slice(-20)
            .map(msg => ({
              ...msg,
              user_nama: users.find(u => u.id === msg.user_id)?.nama || 'Unknown',
              formatted_time: new Date(msg.created_at).toLocaleTimeString()
            }));
          
          ws.send(JSON.stringify({
            type: 'history',
            data: roomMessages
          }));
        }
        
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    
    ws.on('close', () => {
      clearInterval(pingInterval);
      connectedUsers.delete(user.id);
      console.log(`User ${user.nama} disconnected`);
      
      
      const onlineUsers = Array.from(connectedUsers.values()).map(u => ({
        id: u.userId,
        nama: u.nama,
        role: u.role
      }));
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(JSON.stringify({
            type: 'online_users',
            data: onlineUsers
          }));
        }
      });
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(pingInterval);
      connectedUsers.delete(user.id);
    });
    
    
    const otherUsers = Array.from(connectedUsers.values())
      .filter(u => u.userId !== user.id)
      .map(u => ({
        id: u.userId,
        nama: u.nama,
        role: u.role
      }));
    
    if (otherUsers.length > 0) {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(JSON.stringify({
            type: 'user_joined',
            user: {
              id: user.id,
              nama: user.nama,
              role: user.role
            },
            online_users: Array.from(connectedUsers.values()).map(u => ({
              id: u.userId,
              nama: u.nama,
              role: u.role
            }))
          }));
        }
      });
    }
    
  });

  
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return wss;
}