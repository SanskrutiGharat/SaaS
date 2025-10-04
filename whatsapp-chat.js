// WhatsApp-style Chat Application
class WhatsAppChat {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentChat = null;
        this.currentChatType = null; // 'user' or 'group'
        this.contacts = [];
        this.groups = [];
        this.messages = {};
        this.onlineUsers = new Set();
        this.typingUsers = new Set();
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkAuthAndInitialize();
    }

    initializeElements() {
        this.userAvatar = document.getElementById('userAvatar');
        this.userName = document.getElementById('userName');
        this.chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
        this.chatHeaderName = document.getElementById('chatHeaderName');
        this.chatHeaderStatus = document.getElementById('chatHeaderStatus');
        this.contactsList = document.getElementById('contactsList');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.typingText = document.getElementById('typingText');
        this.searchInput = document.getElementById('searchInput');
        this.groupInfo = document.getElementById('groupInfo');
        this.groupName = document.getElementById('groupName');
        this.groupDescription = document.getElementById('groupDescription');
        this.groupMembers = document.getElementById('groupMembers');
    }

    setupEventListeners() {
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

        // Search
        this.searchInput.addEventListener('input', (e) => {
            this.filterContacts(e.target.value);
        });

        // File input (hidden)
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.multiple = true;
        this.fileInput.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        document.body.appendChild(this.fileInput);
    }

    async checkAuthAndInitialize() {
        try {
            const response = await fetch('/api/auth/status');
            if (!response.ok) {
                window.location.href = '/';
                return;
            }
            
            const data = await response.json();
            this.currentUser = data.user;
            this.updateUserInfo();
            this.initializeSocket();
            this.loadContacts();
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    }

    updateUserInfo() {
        this.userAvatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
        this.userName.textContent = this.currentUser.username;
        
        // Show organization info if available
        if (this.currentUser.organizationName) {
            const orgInfo = document.createElement('div');
            orgInfo.className = 'org-info';
            orgInfo.textContent = this.currentUser.organizationName;
            orgInfo.style.fontSize = '12px';
            orgInfo.style.opacity = '0.8';
            orgInfo.style.marginTop = '2px';
            
            const userProfile = document.querySelector('.user-profile');
            if (userProfile && !userProfile.querySelector('.org-info')) {
                userProfile.appendChild(orgInfo);
            }
        }
    }

    initializeSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to chat server');
            this.socket.emit('join-user', {
                userId: this.currentUser.userId,
                username: this.currentUser.username,
                organizationId: this.currentUser.organizationId,
                role: this.currentUser.role
            });
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from chat server');
        });

        this.socket.on('new-message', (data) => {
            this.handleNewMessage(data);
        });

        this.socket.on('message-delivered', (data) => {
            this.updateMessageStatus(data.messageId, 'delivered');
        });

        this.socket.on('message-read', (data) => {
            this.updateMessageStatus(data.messageId, 'read');
        });

        this.socket.on('user-typing', (data) => {
            this.showTypingIndicator(data.userId, data.username, data.isTyping);
        });

        this.socket.on('user-online', (data) => {
            this.onlineUsers.add(data.userId);
            this.updateContactStatus(data.userId, 'online');
        });

        this.socket.on('user-offline', (data) => {
            this.onlineUsers.delete(data.userId);
            this.updateContactStatus(data.userId, 'offline');
        });

        this.socket.on('group-created', (data) => {
            this.groups.push(data.group);
            this.renderContacts();
        });

        this.socket.on('group-member-added', (data) => {
            this.updateGroupMembers(data.groupId, data.members);
        });
    }

    async loadContacts() {
        try {
            // Load users for contacts
            const usersResponse = await fetch('/api/users');
            if (usersResponse.ok) {
                const users = await usersResponse.json();
                this.contacts = users.filter(user => user.id !== this.currentUser.userId);
            }

            // Load groups
            const groupsResponse = await fetch('/api/chat/groups');
            if (groupsResponse.ok) {
                this.groups = await groupsResponse.json();
            }

            this.renderContacts();
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    }

    renderContacts() {
        this.contactsList.innerHTML = '';
        
        // Render individual contacts
        this.contacts.forEach(contact => {
            const contactElement = this.createContactElement(contact, 'user');
            this.contactsList.appendChild(contactElement);
        });

        // Render groups
        this.groups.forEach(group => {
            const groupElement = this.createContactElement(group, 'group');
            this.contactsList.appendChild(groupElement);
        });
    }

    createContactElement(item, type) {
        const element = document.createElement('div');
        element.className = 'contact-item';
        element.dataset.id = item.id;
        element.dataset.type = type;
        
        const avatar = document.createElement('div');
        avatar.className = 'contact-avatar';
        avatar.textContent = type === 'group' ? '👥' : item.username.charAt(0).toUpperCase();
        
        const info = document.createElement('div');
        info.className = 'contact-info';
        
        const name = document.createElement('div');
        name.className = 'contact-name';
        name.textContent = type === 'group' ? item.name : item.username;
        
        const lastMessage = document.createElement('div');
        lastMessage.className = 'contact-last-message';
        lastMessage.textContent = item.lastMessage || 'No messages yet';
        
        info.appendChild(name);
        info.appendChild(lastMessage);
        
        const time = document.createElement('div');
        time.className = 'contact-time';
        time.textContent = item.lastMessageTime ? this.formatTime(item.lastMessageTime) : '';
        
        element.appendChild(avatar);
        element.appendChild(info);
        element.appendChild(time);
        
        if (item.unreadCount > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = item.unreadCount;
            element.appendChild(badge);
        }
        
        element.addEventListener('click', () => {
            this.selectChat(item.id, type);
        });
        
        return element;
    }

    selectChat(chatId, chatType) {
        // Update active contact
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-id="${chatId}"][data-type="${chatType}"]`).classList.add('active');
        
        this.currentChat = chatId;
        this.currentChatType = chatType;
        
        // Update chat header
        const contact = chatType === 'group' 
            ? this.groups.find(g => g.id === chatId)
            : this.contacts.find(c => c.id === chatId);
            
        if (contact) {
            this.chatHeaderName.textContent = chatType === 'group' ? contact.name : contact.username;
            this.chatHeaderStatus.textContent = chatType === 'group' 
                ? `${contact.memberCount || 0} members`
                : (this.onlineUsers.has(chatId) ? 'online' : 'last seen recently');
            this.chatHeaderAvatar.textContent = chatType === 'group' ? '👥' : contact.username.charAt(0).toUpperCase();
        }
        
        // Show/hide group info
        this.groupInfo.style.display = chatType === 'group' ? 'block' : 'none';
        
        // Enable input
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;
        
        // Load messages
        this.loadMessages(chatId, chatType);
        
        // Join socket room
        this.socket.emit('join-chat', {
            chatId: chatId,
            chatType: chatType,
            userId: this.currentUser.userId
        });
    }

    async loadMessages(chatId, chatType) {
        try {
            const response = await fetch(`/api/chat/messages/${chatId}?type=${chatType}`);
            if (response.ok) {
                const messages = await response.json();
                this.messages[`${chatType}_${chatId}`] = messages;
                this.renderMessages(messages);
                
                // Mark messages as read
                this.markMessagesAsRead(chatId, chatType);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        this.chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            this.chatMessages.innerHTML = `
                <div class="empty-chat">
                    <div class="empty-chat-icon">💬</div>
                    <h3>No messages yet</h3>
                    <p>Start the conversation by sending a message!</p>
                </div>
            `;
            return;
        }
        
        messages.forEach(message => {
            this.addMessageToChat(message);
        });
        
        this.scrollToBottom();
    }

    addMessageToChat(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender_id === this.currentUser.userId ? 'sent' : 'received'}`;
        messageDiv.dataset.messageId = message.id;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = message.message;
        
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.formatTime(message.timestamp);
        
        const status = document.createElement('span');
        status.className = 'message-status';
        status.textContent = this.getMessageStatusIcon(message);
        
        meta.appendChild(time);
        meta.appendChild(status);
        
        content.appendChild(text);
        content.appendChild(meta);
        messageDiv.appendChild(content);
        
        this.chatMessages.appendChild(messageDiv);
    }

    getMessageStatusIcon(message) {
        if (message.sender_id !== this.currentUser.userId) {
            return '';
        }
        
        if (message.is_read) {
            return '✓✓';
        } else if (message.is_delivered) {
            return '✓✓';
        } else {
            return '✓';
        }
    }

    async sendMessage() {
        const messageText = this.messageInput.value.trim();
        if (!messageText || !this.currentChat) return;
        
        const messageData = {
            sender_id: this.currentUser.userId,
            receiver_id: this.currentChatType === 'user' ? this.currentChat : null,
            group_id: this.currentChatType === 'group' ? this.currentChat : null,
            message: messageText,
            message_type: 'text'
        };
        
        try {
            const response = await fetch('/api/chat/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messageData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.messageInput.value = '';
                this.autoResizeTextarea();
                
                // Emit to socket for real-time delivery
                this.socket.emit('send-message', {
                    ...messageData,
                    messageId: result.messageId,
                    timestamp: result.timestamp
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    handleNewMessage(data) {
        // Add message to current chat if it's the active chat
        if ((this.currentChatType === 'user' && data.receiver_id === this.currentUser.userId && data.sender_id === this.currentChat) ||
            (this.currentChatType === 'group' && data.group_id === this.currentChat)) {
            this.addMessageToChat(data);
            this.scrollToBottom();
            
            // Mark as delivered
            this.socket.emit('message-delivered', { messageId: data.id });
        }
        
        // Update contact list with last message
        this.updateContactLastMessage(data);
    }

    updateMessageStatus(messageId, status) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.textContent = status === 'read' ? '✓✓' : '✓✓';
                statusElement.className = `message-status ${status}`;
            }
        }
    }

    handleTyping() {
        if (!this.currentChat) return;
        
        this.socket.emit('typing', {
            chatId: this.currentChat,
            chatType: this.currentChatType,
            userId: this.currentUser.userId,
            username: this.currentUser.username,
            isTyping: true
        });
        
        // Clear typing indicator after 2 seconds
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('typing', {
                chatId: this.currentChat,
                chatType: this.currentChatType,
                userId: this.currentUser.userId,
                username: this.currentUser.username,
                isTyping: false
            });
        }, 2000);
    }

    showTypingIndicator(userId, username, isTyping) {
        if (!this.currentChat || userId === this.currentUser.userId) return;
        
        if (isTyping) {
            this.typingUsers.add(userId);
        } else {
            this.typingUsers.delete(userId);
        }
        
        if (this.typingUsers.size > 0) {
            const users = Array.from(this.typingUsers);
            this.typingText.textContent = `${users.map(id => this.getUsernameById(id)).join(', ')} ${users.length === 1 ? 'is' : 'are'} typing`;
            this.typingIndicator.style.display = 'flex';
        } else {
            this.typingIndicator.style.display = 'none';
        }
    }

    getUsernameById(userId) {
        const contact = this.contacts.find(c => c.id === userId);
        return contact ? contact.username : 'Unknown';
    }

    updateContactStatus(userId, status) {
        const contactElement = document.querySelector(`[data-id="${userId}"][data-type="user"]`);
        if (contactElement) {
            const statusElement = contactElement.querySelector('.contact-last-message');
            if (statusElement && !contactElement.querySelector('.contact-last-message').textContent.includes('No messages')) {
                // Update status in a subtle way
                contactElement.dataset.status = status;
            }
        }
    }

    updateContactLastMessage(messageData) {
        const chatKey = messageData.group_id ? `group_${messageData.group_id}` : `user_${messageData.sender_id}`;
        const contactElement = document.querySelector(`[data-id="${messageData.group_id || messageData.sender_id}"]`);
        
        if (contactElement) {
            const lastMessageElement = contactElement.querySelector('.contact-last-message');
            const timeElement = contactElement.querySelector('.contact-time');
            
            if (lastMessageElement) {
                lastMessageElement.textContent = messageData.message;
            }
            if (timeElement) {
                timeElement.textContent = this.formatTime(messageData.timestamp);
            }
        }
    }

    async markMessagesAsRead(chatId, chatType) {
        try {
            await fetch('/api/chat/mark-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chatId: chatId,
                    chatType: chatType,
                    userId: this.currentUser.userId
                })
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    filterContacts(searchTerm) {
        const contacts = document.querySelectorAll('.contact-item');
        contacts.forEach(contact => {
            const name = contact.querySelector('.contact-name').textContent.toLowerCase();
            const message = contact.querySelector('.contact-last-message').textContent.toLowerCase();
            const matches = name.includes(searchTerm.toLowerCase()) || message.includes(searchTerm.toLowerCase());
            contact.style.display = matches ? 'flex' : 'none';
        });
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'now';
        } else if (diff < 3600000) { // Less than 1 hour
            return Math.floor(diff / 60000) + 'm';
        } else if (diff < 86400000) { // Less than 1 day
            return Math.floor(diff / 3600000) + 'h';
        } else {
            return date.toLocaleDateString();
        }
    }

    // File handling
    attachFile() {
        this.fileInput.click();
    }

    async handleFileUpload(files) {
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('chatId', this.currentChat);
            formData.append('chatType', this.currentChatType);
            formData.append('senderId', this.currentUser.userId);
            
            try {
                const response = await fetch('/api/chat/upload-file', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    // Handle file message
                    console.log('File uploaded:', result);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        }
    }

    // Group management
    async createGroup() {
        const name = prompt('Enter group name:');
        if (!name) return;
        
        try {
            const response = await fetch('/api/chat/create-group', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    createdBy: this.currentUser.userId
                })
            });
            
            if (response.ok) {
                const group = await response.json();
                this.groups.push(group);
                this.renderContacts();
            }
        } catch (error) {
            console.error('Error creating group:', error);
        }
    }

    // UI helpers
    switchTab(tab) {
        document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        
        if (tab === 'groups') {
            // Show groups or create group option
            this.showGroupManagement();
        } else {
            this.renderContacts();
        }
    }

    toggleSidebar() {
        if (window.innerWidth <= 768) {
            document.getElementById('chatSidebar').classList.toggle('show');
        }
    }

    startVideoCall() {
        alert('Video call feature coming soon!');
    }

    startVoiceCall() {
        alert('Voice call feature coming soon!');
    }

    showChatInfo() {
        alert('Chat info feature coming soon!');
    }

    toggleEmojiPicker() {
        alert('Emoji picker coming soon!');
    }
}

// Global functions for HTML onclick events
function switchTab(tab) {
    if (window.whatsappChat) {
        window.whatsappChat.switchTab(tab);
    }
}

function sendMessage() {
    if (window.whatsappChat) {
        window.whatsappChat.sendMessage();
    }
}

function attachFile() {
    if (window.whatsappChat) {
        window.whatsappChat.attachFile();
    }
}

function toggleSidebar() {
    if (window.whatsappChat) {
        window.whatsappChat.toggleSidebar();
    }
}

function startVideoCall() {
    if (window.whatsappChat) {
        window.whatsappChat.startVideoCall();
    }
}

function startVoiceCall() {
    if (window.whatsappChat) {
        window.whatsappChat.startVoiceCall();
    }
}

function showChatInfo() {
    if (window.whatsappChat) {
        window.whatsappChat.showChatInfo();
    }
}

function toggleEmojiPicker() {
    if (window.whatsappChat) {
        window.whatsappChat.toggleEmojiPicker();
    }
}

// Initialize chat app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.whatsappChat = new WhatsAppChat();
});
