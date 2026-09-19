package main

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
)

const wsMagicGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// WSConn represents a connected RFC 6455 WebSocket client with user identity.
type WSConn struct {
	conn        net.Conn
	bufrw       *bufio.ReadWriter
	mu          sync.Mutex
	isClosed    bool
	// User identity — populated from JWT after WS handshake
	UserID      string
	UserName    string
	AvatarURL   string
	Role        string
	WorkspaceID string
	ProjectID   string // currently viewed project (set via SET_PROJECT message)
}

// Hub manages all active WebSocket and SSE clients
type Hub struct {
	clients  map[*WSConn]bool
	sseChans map[chan []byte]bool
	mu       sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:  make(map[*WSConn]bool),
		sseChans: make(map[chan []byte]bool),
	}
}

func (h *Hub) RegisterWS(c *WSConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
	log.Printf("[WebSocket] Client connected (user=%s). Total active clients: %d", c.UserName, len(h.clients))
}

func (h *Hub) UnregisterWS(c *WSConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		_ = c.Close()
		log.Printf("[WebSocket] Client disconnected (user=%s). Remaining: %d", c.UserName, len(h.clients))
	}
}

func (h *Hub) RegisterSSE(ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sseChans[ch] = true
}

func (h *Hub) UnregisterSSE(ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.sseChans, ch)
}

// Broadcast sends a message to all connected WebSocket clients and SSE channels
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Broadcast to WebSockets
	for client := range h.clients {
		go func(c *WSConn) {
			if err := c.WriteText(msg); err != nil {
				h.UnregisterWS(c)
			}
		}(client)
	}

	// Broadcast to SSE
	for ch := range h.sseChans {
		select {
		case ch <- msg:
		default:
			// channel full, drop frame
		}
	}
}

// BroadcastToWorkspace sends a message only to WS clients in the given workspace.
func (h *Hub) BroadcastToWorkspace(workspaceID string, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		if client.WorkspaceID == workspaceID {
			go func(c *WSConn) {
				if err := c.WriteText(msg); err != nil {
					h.UnregisterWS(c)
				}
			}(client)
		}
	}
}

// GetPresence returns all online users in a workspace as PresenceUser slice.
func (h *Hub) GetPresence(workspaceID string) []PresenceUser {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var result []PresenceUser
	for c := range h.clients {
		if c.WorkspaceID == workspaceID && c.UserID != "" {
			result = append(result, PresenceUser{
				UserID:    c.UserID,
				UserName:  c.UserName,
				AvatarURL: c.AvatarURL,
				Role:      c.Role,
				ProjectID: c.ProjectID,
			})
		}
	}
	return result
}

// BroadcastPresence emits a PRESENCE_UPDATE event to all clients in the workspace.
func (h *Hub) BroadcastPresence(workspaceID string) {
	online := h.GetPresence(workspaceID)
	msg, _ := json.Marshal(map[string]interface{}{
		"action":  "PRESENCE_UPDATE",
		"members": online,
	})
	h.BroadcastToWorkspace(workspaceID, msg)
}

// Upgrade upgrades an HTTP connection to RFC 6455 WebSocket
func Upgrade(w http.ResponseWriter, r *http.Request) (*WSConn, error) {
	if r.Header.Get("Upgrade") != "websocket" {
		return nil, errors.New("expected websocket upgrade header")
	}

	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		return nil, errors.New("missing Sec-WebSocket-Key")
	}

	// Compute accept hash
	hash := sha1.New()
	hash.Write([]byte(key + wsMagicGUID))
	accept := base64.StdEncoding.EncodeToString(hash.Sum(nil))

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, errors.New("responseWriter does not implement Hijacker")
	}

	conn, bufrw, err := hijacker.Hijack()
	if err != nil {
		return nil, err
	}

	// Send handshake response
	response := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"

	if _, err := bufrw.WriteString(response); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := bufrw.Flush(); err != nil {
		_ = conn.Close()
		return nil, err
	}

	return &WSConn{
		conn:  conn,
		bufrw: bufrw,
	}, nil
}

// WriteText sends a text frame (opcode 0x1) to the client
func (c *WSConn) WriteText(payload []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.isClosed {
		return errors.New("connection closed")
	}

	length := len(payload)
	var header []byte

	// Byte 0: FIN (0x80) | Opcode Text (0x01) = 0x81
	header = append(header, 0x81)

	// Byte 1: Mask (0 for server) | Length
	if length <= 125 {
		header = append(header, byte(length))
	} else if length <= 65535 {
		header = append(header, 126)
		lenBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(lenBytes, uint16(length))
		header = append(header, lenBytes...)
	} else {
		header = append(header, 127)
		lenBytes := make([]byte, 8)
		binary.BigEndian.PutUint64(lenBytes, uint64(length))
		header = append(header, lenBytes...)
	}

	if _, err := c.bufrw.Write(header); err != nil {
		c.isClosed = true
		return err
	}
	if _, err := c.bufrw.Write(payload); err != nil {
		c.isClosed = true
		return err
	}
	return c.bufrw.Flush()
}

// ReadMessage reads the next frame from client (masks are unmasked)
func (c *WSConn) ReadMessage() ([]byte, error) {
	for {
		b0, err := c.bufrw.ReadByte()
		if err != nil {
			return nil, err
		}

		opcode := b0 & 0x0F
		b1, err := c.bufrw.ReadByte()
		if err != nil {
			return nil, err
		}

		isMasked := (b1 & 0x80) != 0
		payloadLen := int(b1 & 0x7F)

		if payloadLen == 126 {
			var l uint16
			if err := binary.Read(c.bufrw, binary.BigEndian, &l); err != nil {
				return nil, err
			}
			payloadLen = int(l)
		} else if payloadLen == 127 {
			var l uint64
			if err := binary.Read(c.bufrw, binary.BigEndian, &l); err != nil {
				return nil, err
			}
			payloadLen = int(l)
		}

		var maskKey [4]byte
		if isMasked {
			if _, err := io.ReadFull(c.bufrw, maskKey[:]); err != nil {
				return nil, err
			}
		}

		payload := make([]byte, payloadLen)
		if _, err := io.ReadFull(c.bufrw, payload); err != nil {
			return nil, err
		}

		if isMasked {
			for i := 0; i < payloadLen; i++ {
				payload[i] ^= maskKey[i%4]
			}
		}

		// Handle opcodes
		switch opcode {
		case 0x1: // Text frame
			return payload, nil
		case 0x8: // Close
			c.Close()
			return nil, io.EOF
		case 0x9: // Ping -> reply with Pong
			c.writeControl(0xA, payload)
		case 0xA: // Pong
			continue
		}
	}
}

func (c *WSConn) writeControl(opcode byte, payload []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	header := []byte{0x80 | opcode, byte(len(payload))}
	_, _ = c.bufrw.Write(header)
	_, _ = c.bufrw.Write(payload)
	_ = c.bufrw.Flush()
}

func (c *WSConn) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.isClosed = true
	return c.conn.Close()
}
