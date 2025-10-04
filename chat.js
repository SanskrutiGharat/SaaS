// Chat functionality with Socket.IO
class ChatApp {
    constructor() {
        this.socket = null;
        this.currentRoom = 'general';
        this.username = null;
        this.isConnected = false;
        this.typingTimer = null;
        this.onlineUsers = new Set();
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.usernameInput = document.getElementById('usernameInput');
        this.connectButton = document.getElementById('connectButton');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.currentRoomElement = document.getElementById('currentRoom');
        this.userCount = document.getElementById('userCount');
        this.onlineUsersList = document.getElementById('onlineUsersList');
        this.roomItems = document.querySelectorAll('.room-item');
    }

    setupEventListeners() {
        // Username input
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.usernameInput.value.trim()) {
                this.connectToChat();
            }
        });

        // Message input
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.handleTyping();
            this.autoResizeTextarea();
        });

        // Room selection
        this.roomItems.forEach(item => {
            item.addEventListener('click', () => {
                if (this.isConnected) {
                    this.switchRoom(item.dataset.room);
                }
            });
        });

        // Connect button
        this.connectButton.addEventListener('click', () => {
            this.connectToChat();
        });
    }

    connectToChat() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            alert('Please enter a username');
            return;
        }

        this.username = username;
        this.connectButton.disabled = true;
        this.connectButton.textContent = 'Connecting...';

        // Connect to Socket.IO
        this.socket = io();

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.joinRoom(this.currentRoom);
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
            this.connectButton.textContent = 'Connected';
            this.usernameInput.disabled = true;
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.messageInput.disabled = true;
            this.sendButton.disabled = true;
            this.connectButton.disabled = false;
            this.connectButton.textContent = 'Reconnect';
            this.usernameInput.disabled = false;
        });

        this.socket.on('new-message', (data) => {
            this.displayMessage(data);
        });

        this.socket.on('user-joined', (data) => {
            this.displaySystemMessage(data.message);
            this.updateOnlineUsers();
        });

        this.socket.on('user-left', (data) => {
            this.displaySystemMessage(data.message);
            this.updateOnlineUsers();
        });

        this.socket.on('user-typing', (data) => {
            this.showTypingIndicator(data.username, data.isTyping);
        });

        // Load chat history
        this.loadChatHistory();
    }

    joinRoom(room) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join-room', {
                room: room,
                username: this.username
            });
            this.currentRoom = room;
            this.updateRoomDisplay();
            this.updateOnlineUsers();
        }
    }

    switchRoom(newRoom) {
        if (newRoom === this.currentRoom) return;

        // Clear current room messages
        this.chatMessages.innerHTML = '';
        
        // Update room selection UI
        this.roomItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.room === newRoom) {
                item.classList.add('active');
            }
        });

        // Join new room
        this.joinRoom(newRoom);
        
        // Load chat history for new room
        this.loadChatHistory();
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isConnected) return;

        this.socket.emit('chat-message', {
            message: message,
            room: this.currentRoom,
            username: this.username
        });

        this.messageInput.value = '';
        this.autoResizeTextarea();
        this.clearTypingIndicator();
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.username === this.username ? 'own' : 'other'}`;

        const time = new Date(data.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${data.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    displaySystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.innerHTML = `<div class="message-content">${this.escapeHtml(message)}</div>`;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    handleTyping() {
        if (!this.isConnected) return;

        // Clear existing timer
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // Emit typing event
        this.socket.emit('typing', {
            room: this.currentRoom,
            username: this.username,
            isTyping: true
        });

        // Set timer to stop typing indicator
        this.typingTimer = setTimeout(() => {
            this.socket.emit('typing', {
                room: this.currentRoom,
                username: this.username,
                isTyping: false
            });
        }, 1000);
    }

    showTypingIndicator(username, isTyping) {
        if (username === this.username) return;

        const typingUsers = this.typingIndicator.dataset.typingUsers || '';
        let users = typingUsers ? typingUsers.split(',') : [];
        
        if (isTyping && !users.includes(username)) {
            users.push(username);
        } else if (!isTyping && users.includes(username)) {
            users = users.filter(u => u !== username);
        }

        this.typingIndicator.dataset.typingUsers = users.join(',');
        
        if (users.length > 0) {
            this.typingIndicator.textContent = `${users.join(', ')} ${users.length === 1 ? 'is' : 'are'} typing...`;
        } else {
            this.typingIndicator.textContent = '';
        }
    }

    clearTypingIndicator() {
        this.typingIndicator.textContent = '';
        this.typingIndicator.dataset.typingUsers = '';
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.statusIndicator.classList.remove('offline');
            this.connectionStatus.textContent = 'Connected';
        } else {
            this.statusIndicator.classList.add('offline');
            this.connectionStatus.textContent = 'Disconnected';
        }
    }

    updateRoomDisplay() {
        const roomNames = {
            'general': 'General Chat',
            'support': 'Support Chat',
            'development': 'Development Chat',
            'marketing': 'Marketing Chat'
        };
        this.currentRoomElement.textContent = roomNames[this.currentRoom] || this.currentRoom;
    }

    async updateOnlineUsers() {
        try {
            const response = await fetch(`/api/chat/${this.currentRoom}/users`);
            const users = await response.json();
            
            this.onlineUsersList.innerHTML = '';
            
            if (users.length === 0) {
                this.onlineUsersList.innerHTML = '<p style="color: #6c757d; font-style: italic;">No users online</p>';
            } else {
                users.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'user-item';
                    userDiv.innerHTML = `
                        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div class="user-name">${this.escapeHtml(user.username)}</div>
                    `;
                    this.onlineUsersList.appendChild(userDiv);
                });
            }
            
            this.userCount.textContent = `${users.length} user${users.length === 1 ? '' : 's'} online`;
        } catch (error) {
            console.error('Error fetching online users:', error);
        }
    }

    async loadChatHistory() {
        try {
            const response = await fetch(`/api/chat/${this.currentRoom}/messages?limit=50`);
            const messages = await response.json();
            
            // Clear existing messages
            this.chatMessages.innerHTML = '';
            
            if (messages.length === 0) {
                this.displaySystemMessage('No previous messages in this room. Start the conversation!');
            } else {
                messages.forEach(message => {
                    this.displayMessage(message);
                });
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.displaySystemMessage('Error loading chat history');
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    autoResizeTextarea() {
        const textarea = this.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for HTML onclick events
function connectToChat() {
    if (window.chatApp) {
        window.chatApp.connectToChat();
    }
}

function sendMessage() {
    if (window.chatApp) {
        window.chatApp.sendMessage();
    }
}

// Initialize chat app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});

// Update online users periodically
setInterval(() => {
    if (window.chatApp && window.chatApp.isConnected) {
        window.chatApp.updateOnlineUsers();
    }
}, 5000);
