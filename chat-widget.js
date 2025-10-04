// Floating Chat Widget
class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.isMinimized = false;
        this.widget = null;
        this.initializeWidget();
    }

    initializeWidget() {
        // Create widget HTML
        const widgetHTML = `
            <div id="chatWidget" class="chat-widget">
                <div class="chat-widget-header" onclick="chatWidget.toggleChat()">
                    <div class="chat-widget-title">
                        <span class="chat-icon">💬</span>
                        <span class="chat-title">Live Chat</span>
                    </div>
                    <div class="chat-widget-controls">
                        <span class="chat-status-indicator offline" id="chatStatusIndicator"></span>
                        <span class="chat-toggle-btn" id="chatToggleBtn">−</span>
                    </div>
                </div>
                <div class="chat-widget-content" id="chatWidgetContent">
                    <div class="chat-widget-messages" id="chatWidgetMessages">
                        <div class="chat-welcome">
                            <p>Need help? Start a conversation!</p>
                        </div>
                    </div>
                    <div class="chat-widget-input-area">
                        <input type="text" id="chatWidgetInput" placeholder="Type your message..." disabled>
                        <button id="chatWidgetSend" onclick="chatWidget.sendMessage()" disabled>Send</button>
                    </div>
                    <div class="chat-widget-footer">
                        <button onclick="chatWidget.openFullChat()">Open Full Chat</button>
                    </div>
                </div>
            </div>
        `;

        // Add widget to page
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        
        // Add styles
        this.addWidgetStyles();
        
        // Initialize widget
        this.widget = document.getElementById('chatWidget');
        this.chatWidgetContent = document.getElementById('chatWidgetContent');
        this.chatWidgetMessages = document.getElementById('chatWidgetMessages');
        this.chatWidgetInput = document.getElementById('chatWidgetInput');
        this.chatWidgetSend = document.getElementById('chatWidgetSend');
        this.chatStatusIndicator = document.getElementById('chatStatusIndicator');
        this.chatToggleBtn = document.getElementById('chatToggleBtn');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize Socket.IO connection
        this.initializeSocket();
    }

    addWidgetStyles() {
        const styles = `
            <style>
                .chat-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    transition: all 0.3s ease;
                }

                .chat-widget.minimized {
                    height: 60px;
                }

                .chat-widget.hidden {
                    transform: translateY(calc(100% - 60px));
                }

                .chat-widget-header {
                    background: #007bff;
                    color: white;
                    padding: 15px;
                    border-radius: 10px 10px 0 0;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                }

                .chat-widget-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .chat-icon {
                    font-size: 18px;
                }

                .chat-title {
                    font-weight: 600;
                    font-size: 14px;
                }

                .chat-widget-controls {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .chat-status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #dc3545;
                }

                .chat-status-indicator.online {
                    background: #28a745;
                }

                .chat-toggle-btn {
                    font-size: 18px;
                    font-weight: bold;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }

                .chat-widget-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .chat-widget.minimized .chat-widget-content {
                    display: none;
                }

                .chat-widget-messages {
                    flex: 1;
                    padding: 15px;
                    overflow-y: auto;
                    background: #f8f9fa;
                }

                .chat-welcome {
                    text-align: center;
                    color: #6c757d;
                    padding: 20px;
                }

                .chat-widget-message {
                    margin-bottom: 10px;
                    padding: 8px 12px;
                    border-radius: 12px;
                    max-width: 80%;
                    word-wrap: break-word;
                    font-size: 13px;
                }

                .chat-widget-message.own {
                    background: #007bff;
                    color: white;
                    margin-left: auto;
                    text-align: right;
                }

                .chat-widget-message.other {
                    background: white;
                    color: #333;
                    border: 1px solid #e9ecef;
                }

                .chat-widget-message.system {
                    background: transparent;
                    color: #6c757d;
                    text-align: center;
                    font-style: italic;
                    font-size: 12px;
                    border: none;
                    margin: 0 auto;
                }

                .chat-widget-input-area {
                    padding: 15px;
                    border-top: 1px solid #e9ecef;
                    display: flex;
                    gap: 10px;
                    background: white;
                }

                .chat-widget-input-area input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 20px;
                    font-size: 13px;
                    outline: none;
                }

                .chat-widget-input-area input:focus {
                    border-color: #007bff;
                }

                .chat-widget-input-area button {
                    padding: 8px 16px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                }

                .chat-widget-input-area button:hover:not(:disabled) {
                    background: #0056b3;
                }

                .chat-widget-input-area button:disabled {
                    background: #6c757d;
                    cursor: not-allowed;
                }

                .chat-widget-footer {
                    padding: 10px 15px;
                    border-top: 1px solid #e9ecef;
                    background: #f8f9fa;
                    text-align: center;
                }

                .chat-widget-footer button {
                    background: transparent;
                    color: #007bff;
                    border: 1px solid #007bff;
                    padding: 6px 12px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s;
                }

                .chat-widget-footer button:hover {
                    background: #007bff;
                    color: white;
                }

                @media (max-width: 768px) {
                    .chat-widget {
                        width: calc(100vw - 40px);
                        height: 400px;
                        right: 20px;
                        left: 20px;
                        bottom: 20px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        this.chatWidgetInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.chatWidgetInput.value.trim()) {
                this.sendMessage();
            }
        });

        // Auto-resize on mobile
        if (window.innerWidth <= 768) {
            this.widget.style.height = '400px';
        }
    }

    initializeSocket() {
        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.log('Socket.IO not loaded, chat widget will be limited');
            return;
        }

        this.socket = io();
        this.username = `User_${Math.random().toString(36).substr(2, 9)}`;

        this.socket.on('connect', () => {
            this.chatStatusIndicator.classList.add('online');
            this.chatStatusIndicator.classList.remove('offline');
            this.chatWidgetInput.disabled = false;
            this.chatWidgetSend.disabled = false;
            
            // Join general room
            this.socket.emit('join-room', {
                room: 'general',
                username: this.username
            });
        });

        this.socket.on('disconnect', () => {
            this.chatStatusIndicator.classList.remove('online');
            this.chatStatusIndicator.classList.add('offline');
            this.chatWidgetInput.disabled = true;
            this.chatWidgetSend.disabled = true;
        });

        this.socket.on('new-message', (data) => {
            this.displayMessage(data);
        });

        this.socket.on('user-joined', (data) => {
            if (data.username !== this.username) {
                this.displaySystemMessage(data.message);
            }
        });

        this.socket.on('user-left', (data) => {
            this.displaySystemMessage(data.message);
        });
    }

    toggleChat() {
        if (this.isMinimized) {
            this.widget.classList.remove('minimized');
            this.isMinimized = false;
            this.chatToggleBtn.textContent = '−';
        } else {
            this.widget.classList.add('minimized');
            this.isMinimized = true;
            this.chatToggleBtn.textContent = '+';
        }
    }

    sendMessage() {
        const message = this.chatWidgetInput.value.trim();
        if (!message || !this.socket) return;

        this.socket.emit('chat-message', {
            message: message,
            room: 'general',
            username: this.username
        });

        this.chatWidgetInput.value = '';
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-widget-message ${data.username === this.username ? 'own' : 'other'}`;
        messageDiv.textContent = data.message;
        
        this.chatWidgetMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    displaySystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-widget-message system';
        messageDiv.textContent = message;
        
        this.chatWidgetMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatWidgetMessages.scrollTop = this.chatWidgetMessages.scrollHeight;
    }

    openFullChat() {
        window.open('chat.html', '_blank', 'width=1000,height=700');
    }
}

// Initialize chat widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not on chat page
    if (!window.location.pathname.includes('chat.html')) {
        window.chatWidget = new ChatWidget();
    }
});

// Global functions for onclick events
function toggleChat() {
    if (window.chatWidget) {
        window.chatWidget.toggleChat();
    }
}

function sendMessage() {
    if (window.chatWidget) {
        window.chatWidget.sendMessage();
    }
}

function openFullChat() {
    if (window.chatWidget) {
        window.chatWidget.openFullChat();
    }
}
