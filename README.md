# Remote Work Management Platform

A comprehensive, modern platform for managing remote teams, tasks, and collaboration with a beautiful UI and Progressive Web App (PWA) features.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization**
  - Secure login with email verification
  - Organization-based access control
  - Password reset functionality
  - JWT-based session management

- **Team Management**
  - Create and manage multiple teams
  - Role-based permissions (Admin/Member)
  - Team member invitation system
  - Real-time team collaboration

- **Task Management (Kanban Board)**
  - Visual drag-and-drop interface
  - Task status tracking (To Do, In Progress, Done)
  - Priority levels and due dates
  - Task assignment and comments

- **Real-time Communication**
  - Live chat functionality
  - WebSocket-based messaging
  - Team-specific chat rooms

### Modern UI/UX
- **Responsive Design**
  - Mobile-first approach
  - Touch-friendly interactions
  - Adaptive layouts for all screen sizes

- **Design System**
  - Consistent color palette and typography
  - Modern component library
  - Smooth animations and transitions
  - Dark mode support

- **Accessibility**
  - ARIA labels and keyboard navigation
  - Screen reader compatibility
  - High contrast support
  - Reduced motion preferences

### Progressive Web App (PWA)
- **Offline Functionality**
  - Service worker caching
  - Offline task viewing
  - Background sync for actions

- **Mobile Experience**
  - App-like interface
  - Push notifications
  - Home screen installation
  - Native app shortcuts

## 🛠️ Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS Grid and Flexbox
- **JavaScript (ES6+)** - Vanilla JS with modern features
- **PWA** - Service Worker, Web App Manifest
- **WebSocket** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database (with better-sqlite3)
- **JWT** - Authentication tokens
- **Nodemailer** - Email functionality
- **Socket.io** - Real-time communication

### Security & Performance
- **Helmet.js** - Security headers
- **Rate Limiting** - API protection
- **bcryptjs** - Password hashing
- **Compression** - Response compression
- **CORS** - Cross-origin resource sharing

## 📦 Installation

### Prerequisites
- Node.js (v16.0.0 or higher)
- npm (v8.0.0 or higher)

### Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/remote-work-platform.git
   cd remote-work-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp sample.env .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   
   # Session/JWT
   SESSION_SECRET=your-session-secret
   JWT_SECRET=your-jwt-secret
   
   # Database
   DB_TYPE=sqlite
   SQLITE_FILE=./database.sqlite
   
   # Email Configuration
   EMAIL_FROM="Your App <no-reply@yourdomain.com>"
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # Security
   PASSWORD_RESET_SECRET=your-reset-secret
   PASSWORD_RESET_TTL_MINUTES=15
   INVITE_TTL_HOURS=24
   LOGIN_CODE_TTL_MINUTES=15
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🎯 Usage

### Getting Started
1. **Create an Organization**
   - Visit the login page
   - Click "Register Company"
   - Fill in organization details
   - You'll be logged in as admin

2. **Invite Team Members**
   - Go to Dashboard
   - Use "Invite Employee" feature
   - Team members receive email invitations

3. **Manage Tasks**
   - Navigate to Kanban Board
   - Create, assign, and track tasks
   - Use drag-and-drop to move tasks between columns

4. **Team Collaboration**
   - Use the Teams page to manage team members
   - Access live chat for real-time communication
   - Monitor team activity and progress

### Demo Credentials
- **Username:** demo
- **Email:** demo@example.com
- **Password:** demo123

## 📱 PWA Features

### Installation
1. Open the app in a supported browser (Chrome, Edge, Safari)
2. Look for the "Install" button in the address bar
3. Click to install the app on your device

### Offline Usage
- View cached tasks and team information
- Continue working without internet connection
- Changes sync when connection is restored

### Mobile Experience
- App-like interface on mobile devices
- Touch-optimized interactions
- Native app shortcuts
- Push notifications (when configured)

## 🔧 Configuration

### Database
The application uses SQLite by default. To use a different database:

1. **PostgreSQL**
   ```env
   DB_TYPE=postgres
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_database
   DB_USER=your_username
   DB_PASSWORD=your_password
   ```

2. **MySQL**
   ```env
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=your_database
   DB_USER=your_username
   DB_PASSWORD=your_password
   ```

### Email Configuration
Configure SMTP settings for email functionality:

```env
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
```

### Security Settings
Adjust security parameters as needed:

```env
# Session settings
SESSION_SECRET=your-very-long-random-secret
JWT_SECRET=your-jwt-secret-key

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Password reset
PASSWORD_RESET_TTL_MINUTES=15
INVITE_TTL_HOURS=24
```

## 🚀 Deployment

### Heroku
1. Create a Heroku app
2. Set environment variables
3. Deploy:
   ```bash
   git push heroku main
   ```

### Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel/Netlify
- Configure build settings
- Set environment variables
- Deploy from Git repository

## 📊 Performance

### Optimization Features
- **Lazy Loading** - Components load on demand
- **Caching** - Service worker caches static assets
- **Compression** - Gzip compression for responses
- **Minification** - Optimized CSS and JavaScript
- **CDN Ready** - Static assets can be served from CDN

### Monitoring
- Built-in error logging
- Performance metrics
- Database query optimization
- Memory usage monitoring

## 🔒 Security

### Implemented Security Measures
- **Authentication** - JWT-based with secure sessions
- **Authorization** - Role-based access control
- **Password Security** - bcrypt hashing with salt
- **Rate Limiting** - API endpoint protection
- **CORS** - Cross-origin request handling
- **Helmet** - Security headers
- **Input Validation** - Server-side validation
- **SQL Injection Protection** - Parameterized queries

### Best Practices
- Environment variables for secrets
- Regular dependency updates
- Secure session configuration
- HTTPS enforcement in production
- Content Security Policy (CSP)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Inter Font** - Beautiful typography
- **Modern CSS** - Grid and Flexbox layouts
- **PWA** - Progressive Web App standards
- **Express.js** - Robust web framework
- **SQLite** - Lightweight database

## 📞 Support

For support, email support@yourdomain.com or create an issue in the repository.

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Complete authentication system
- Team management functionality
- Kanban board with drag-and-drop
- Real-time chat
- PWA features
- Modern responsive UI
- Mobile optimization

---

**Built with ❤️ for remote teams everywhere**
