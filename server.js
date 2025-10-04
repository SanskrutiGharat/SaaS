require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const nodemailer = require('nodemailer');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_SECRET || 'reset-secret-change';
const PASSWORD_RESET_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || '15', 10);

// Email configuration (using Gmail SMTP - you can change this)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://fonts.googleapis.com", "https://fonts.gstatic.com"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : true,
    credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files with caching headers
app.use(express.static('.', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
}));

// Serve manifest.json with proper headers
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Serve service worker with proper headers
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// Health check route (public)
app.get('/health', (req, res) => {
    res.json({ ok: true });
});

// Public routes - no authentication required
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset-password.html'));
});

app.get('/register-employee.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'register-employee.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

// Simple test route (public)
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test API working fine' });
});

// Protected routes - require authentication
app.get('/dashboard.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/kanban.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'kanban.html'));
});

app.get('/chat.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/teams.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'teams.html'));
});

// Initialize SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables with enhanced structure
function initializeDatabase() {
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
            console.error('Error enabling foreign keys:', err.message);
        }
    });

    // Create organizations table
    db.run(`
        CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            admin_email TEXT UNIQUE NOT NULL,
            industry TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            settings TEXT DEFAULT '{}'
        )
    `, (err) => {
        if (err) {
            console.error('Error creating organizations table:', err.message);
        } else {
            console.log('Organizations table ready');
        }
    });

    // Create users table for authentication (updated with organization support)
    db.run(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            organization_id INTEGER,
            role TEXT DEFAULT 'employee',
            department TEXT,
            position TEXT,
            is_verified BOOLEAN DEFAULT 0,
            verification_token TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1,
            status TEXT DEFAULT 'pending',
            invited_by TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating auth_users table:', err.message);
        } else {
            console.log('Auth users table ready');
            // Ensure required columns exist on existing databases
            ensureAuthUsersColumns();
        }
    });

    // Create user sessions table
    db.run(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES auth_users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating user_sessions table:', err.message);
        } else {
            console.log('User sessions table ready');
        }
    });

    // Create users table for better data organization
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            company TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready');
        }
    });

    // Create contact_messages table with enhanced structure
    db.run(`
        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT,
            message TEXT NOT NULL,
            message_type TEXT DEFAULT 'general',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'new',
            assigned_to INTEGER,
            response TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating contact_messages table:', err.message);
        } else {
            console.log('Contact messages table ready');
        }
    });

    // Create email_verifications table for login verification codes
    db.run(`
        CREATE TABLE IF NOT EXISTS email_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            purpose TEXT DEFAULT 'login',
            expires_at DATETIME NOT NULL,
            consumed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES auth_users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating email_verifications table:', err.message);
        } else {
            console.log('Email verifications table ready');
        }
    });

    // Create password_resets table (hashed tokens)
    db.run(`
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            used BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES auth_users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating password_resets table:', err.message);
        } else {
            console.log('Password resets table ready');
        }
    });

    // Create teams table for team management (without foreign key initially)
    db.run(`
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    `, (err) => {
        if (err) {
            console.error('Error creating teams table:', err.message);
        } else {
            console.log('Teams table ready');
        }
    });

    // Create team_members table for team membership (without foreign keys initially)
    db.run(`
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT 'member',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            UNIQUE(team_id, user_id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating team_members table:', err.message);
        } else {
            console.log('Team members table ready');
        }
    });

    // Helper to ensure missing columns are added for existing installations
    function ensureColumnExists(tableName, columnName, columnDef, done) {
        db.all(`PRAGMA table_info(${tableName})`, (pragmaErr, columns) => {
            if (pragmaErr) {
                console.error(`Error reading schema for ${tableName}:`, pragmaErr.message);
                return done && done(pragmaErr);
            }
            const hasColumn = columns && columns.some(c => c.name === columnName);
            if (hasColumn) return done && done();
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (alterErr) => {
                if (alterErr) {
                    console.error(`Error adding column ${columnName} to ${tableName}:`, alterErr.message);
                } else {
                    console.log(`Added missing column ${tableName}.${columnName}`);
                }
                return done && done(alterErr);
            });
        });
    }

    // Create projects table for better task organization
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            team_id INTEGER,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating projects table:', err.message);
        } else {
            console.log('Projects table ready');
            // Backfill for older DBs that predate team_id column
            ensureColumnExists('projects', 'team_id', 'INTEGER', () => {});
        }
    });

    // Create kanban_tasks table with enhanced structure
    db.run(`
        CREATE TABLE IF NOT EXISTS kanban_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'todo',
            assigned_to INTEGER,
            due_date DATETIME,
            estimated_hours DECIMAL(5,2),
            actual_hours DECIMAL(5,2),
            tags TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating kanban_tasks table:', err.message);
        } else {
            console.log('Kanban tasks table ready');
        }
    });

    // Create task_comments table for task discussions
    db.run(`
        CREATE TABLE IF NOT EXISTS task_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating task_comments table:', err.message);
        } else {
            console.log('Task comments table ready');
        }
    });

    // Create chat_messages table for WhatsApp-like chat functionality
    db.run(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER,
            group_id INTEGER,
            message TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',
            file_path TEXT,
            file_name TEXT,
            file_size INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_delivered BOOLEAN DEFAULT 0,
            is_read BOOLEAN DEFAULT 0,
            read_at DATETIME,
            FOREIGN KEY (sender_id) REFERENCES auth_users(id),
            FOREIGN KEY (receiver_id) REFERENCES auth_users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating chat_messages table:', err.message);
        } else {
            console.log('Chat messages table ready');
        }
    });

    // Create chat_groups table for organization-specific team chats
    db.run(`
        CREATE TABLE IF NOT EXISTS chat_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            organization_id INTEGER NOT NULL,
            created_by INTEGER NOT NULL,
            group_type TEXT DEFAULT 'team',
            is_private BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (organization_id) REFERENCES organizations(id),
            FOREIGN KEY (created_by) REFERENCES auth_users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating chat_groups table:', err.message);
        } else {
            console.log('Chat groups table ready');
        }
    });

    // Create group_members table
    db.run(`
        CREATE TABLE IF NOT EXISTS group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT 0,
            FOREIGN KEY (group_id) REFERENCES chat_groups(id),
            FOREIGN KEY (user_id) REFERENCES auth_users(id),
            UNIQUE(group_id, user_id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating group_members table:', err.message);
        } else {
            console.log('Group members table ready');
        }
    });

    // Create user_contacts table for friend list
    db.run(`
        CREATE TABLE IF NOT EXISTS user_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES auth_users(id),
            FOREIGN KEY (contact_id) REFERENCES auth_users(id),
            UNIQUE(user_id, contact_id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating user_contacts table:', err.message);
        } else {
            console.log('User contacts table ready');
        }
    });

    // Create indexes for better performance
    createIndexes();
    
    // Insert default data
    insertDefaultData();
}

// Adds missing columns to auth_users if the DB was created before new fields
function ensureAuthUsersColumns() {
    db.all("PRAGMA table_info(auth_users)", (err, columns) => {
        if (err) {
            console.error('Error reading auth_users schema:', err.message);
            return;
        }

        const columnNames = new Set(columns.map(c => c.name));

        const alters = [];
        if (!columnNames.has('organization_id')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN organization_id INTEGER");
        }
        if (!columnNames.has('role')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN role TEXT DEFAULT 'employee'");
        }
        if (!columnNames.has('department')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN department TEXT");
        }
        if (!columnNames.has('position')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN position TEXT");
        }
        if (!columnNames.has('is_verified')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN is_verified BOOLEAN DEFAULT 0");
        }
        if (!columnNames.has('verification_token')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN verification_token TEXT");
        }
        if (!columnNames.has('last_login')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN last_login DATETIME");
        }
        if (!columnNames.has('is_active')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN is_active BOOLEAN DEFAULT 1");
        }
        if (!columnNames.has('status')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN status TEXT DEFAULT 'pending'");
        }
        if (!columnNames.has('invited_by')) {
            alters.push("ALTER TABLE auth_users ADD COLUMN invited_by TEXT");
        }

        if (alters.length === 0) {
            return; // Nothing to do
        }

        // Run sequentially
        (function runNext(i) {
            if (i >= alters.length) return;
            db.run(alters[i], (alterErr) => {
                if (alterErr) {
                    console.warn('Column alter warning:', alters[i], alterErr.message);
                } else {
                    console.log('Applied migration:', alters[i]);
                }
                runNext(i + 1);
            });
        })(0);
    });
}

// Create database indexes for better performance
function createIndexes() {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email)',
        'CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status)',
        'CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status)',
        'CREATE INDEX IF NOT EXISTS idx_kanban_tasks_project_id ON kanban_tasks(project_id)',
        'CREATE INDEX IF NOT EXISTS idx_kanban_tasks_assigned_to ON kanban_tasks(assigned_to)',
        'CREATE INDEX IF NOT EXISTS idx_kanban_tasks_priority ON kanban_tasks(priority)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
        'CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by)',
        'CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)',
        'CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiver_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id)',
        'CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON chat_groups(created_by)',
        'CREATE INDEX IF NOT EXISTS idx_chat_groups_organization_id ON chat_groups(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id)',
        'CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_user_contacts_contact_id ON user_contacts(contact_id)',
        'CREATE INDEX IF NOT EXISTS idx_auth_users_organization_id ON auth_users(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role)',
        'CREATE INDEX IF NOT EXISTS idx_organizations_admin_email ON organizations(admin_email)'
    ];

    indexes.forEach(indexSQL => {
        db.run(indexSQL, (err) => {
            if (err) {
                console.error('Error creating index:', err.message);
            }
        });
    });
}

// Insert default data
function insertDefaultData() {
    // Insert default project
    db.run(`
        INSERT OR IGNORE INTO projects (id, name, description, status) 
        VALUES (1, 'Main Project', 'Default project for general tasks', 'active')
    `, (err) => {
        if (err) {
            console.error('Error inserting default project:', err.message);
        } else {
            console.log('Default project created');
        }
    });

    // Create demo organization and user
    createDemoOrganization();
}

// Create demo organization and user for testing
async function createDemoOrganization() {
    try {
        // Check if demo organization already exists
        db.get('SELECT id FROM organizations WHERE name = ?', ['Demo Organization'], async (err, row) => {
            if (err) {
                console.error('Error checking demo organization:', err);
                return;
            }
            
            if (row) {
                console.log('Demo organization already exists');
                createDemoUser(row.id);
                return;
            }
            
            // Create demo organization
            db.run(
                'INSERT INTO organizations (name, admin_email, industry) VALUES (?, ?, ?)',
                ['Demo Organization', 'admin@demo.com', 'Technology'],
                function(err) {
                    if (err) {
                        console.error('Error creating demo organization:', err);
                    } else {
                        console.log('Demo organization created successfully');
                        createDemoUser(this.lastID);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error in createDemoOrganization:', error);
    }
}

// Create demo user for testing
async function createDemoUser(organizationId) {
    try {
        // Check if demo user already exists
        db.get('SELECT id FROM auth_users WHERE username = ?', ['demo'], async (err, row) => {
            if (err) {
                console.error('Error checking demo user:', err);
                return;
            }
            
            if (row) {
                console.log('Demo user already exists');
                return;
            }
            
            // Create demo user
            const passwordHash = await bcrypt.hash('demo123', 10);
            db.run(
                'INSERT INTO auth_users (username, email, password_hash, organization_id, role, department, position, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ['demo', 'demo@example.com', passwordHash, organizationId, 'admin', 'IT', 'System Administrator', 1],
                function(err) {
                    if (err) {
                        console.error('Error creating demo user:', err);
                    } else {
                        console.log('Demo user created successfully');
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error in createDemoUser:', error);
    }
}

// API Routes

// Contact form endpoints
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message, messageType, priority } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            message: 'Name, email, and message are required'
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid email address'
        });
    }

    // Validate message type
    const validMessageTypes = ['general', 'support', 'sales', 'feedback', 'bug_report'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    
    const msgType = validMessageTypes.includes(messageType) ? messageType : 'general';
    const msgPriority = validPriorities.includes(priority) ? priority : 'medium';

    // Check if user exists, if not create one
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error('Error checking user:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Database error. Please try again.'
            });
        }

        let userId = null;
        if (user) {
            userId = user.id;
            insertContactMessage();
        } else {
            // Create new user first
            db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function(err) {
                if (err) {
                    console.error('Error creating user:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to create user. Please try again.'
                    });
                } else {
                    userId = this.lastID;
                    insertContactMessage();
                }
            });
        }

        function insertContactMessage() {
            // Insert message into database with enhanced structure
            const sql = `INSERT INTO contact_messages 
                        (user_id, name, email, subject, message, message_type, priority) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [userId, name, email, subject || '', message, msgType, msgPriority], function(err) {
                if (err) {
                    console.error('Error inserting contact message:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to save message. Please try again.'
                    });
                }

                res.json({
                    success: true,
                    message: 'Message sent successfully!',
                    data: {
                        id: this.lastID,
                        messageType: msgType,
                        priority: msgPriority,
                        userId: userId
                    }
                });
            });
        }
    });
});

// Get all contact messages with structured data (admin endpoint)
app.get('/api/contact', (req, res) => {
    const sql = `
        SELECT 
            cm.*,
            u.name as user_name,
            u.email as user_email,
            u.company as user_company,
            assigned_user.name as assigned_to_name
        FROM contact_messages cm
        LEFT JOIN users u ON cm.user_id = u.id
        LEFT JOIN users assigned_user ON cm.assigned_to = assigned_user.id
        ORDER BY cm.created_at DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching contact messages:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch messages'
            });
        }

        res.json({
            success: true,
            messages: rows
        });
    });
});

// Team management endpoints

// Create a new team
app.post('/api/teams', (req, res) => {
    const { name, description, creator_email } = req.body;
    
    if (!name || !creator_email) {
        return res.status(400).json({
            success: false,
            message: 'Team name and creator email are required'
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(creator_email)) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid email address'
        });
    }

    // Check if user exists, if not create one
    db.get('SELECT id FROM users WHERE email = ?', [creator_email], (err, user) => {
        if (err) {
            console.error('Error checking user:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Database error. Please try again.'
            });
        }

        let userId = null;
        if (user) {
            userId = user.id;
            createTeam();
        } else {
            // Create new user first
            db.run('INSERT INTO users (name, email) VALUES (?, ?)', [creator_email.split('@')[0], creator_email], function(err) {
                if (err) {
                    console.error('Error creating user:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to create user. Please try again.'
                    });
                } else {
                    userId = this.lastID;
                    createTeam();
                }
            });
        }

        function createTeam() {
            // Create team
            const sql = `INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)`;
            
            db.run(sql, [name, description || '', userId], function(err) {
                if (err) {
                    console.error('Error creating team:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to create team. Please try again.'
                    });
                }

                const teamId = this.lastID;

                // Add creator as team member with admin role
                db.run('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)', 
                    [teamId, userId, 'admin'], function(err) {
                    if (err) {
                        console.error('Error adding creator to team:', err.message);
                    }

                    res.json({
                        success: true,
                        message: 'Team created successfully!',
                        team: {
                            id: teamId,
                            name,
                            description,
                            created_by: userId
                        }
                    });
                });
            });
        }
    });
});

// Get all teams for a user
app.get('/api/teams', (req, res) => {
    const { user_email } = req.query;
    
    if (!user_email) {
        return res.status(400).json({
            success: false,
            message: 'User email is required'
        });
    }

    const sql = `
        SELECT DISTINCT t.*, 
               creator.name as creator_name,
               creator.email as creator_email,
               tm.role as user_role
        FROM teams t
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE u.email = ? AND t.is_active = 1 AND tm.is_active = 1
        ORDER BY t.created_at DESC
    `;
    
    db.all(sql, [user_email], (err, rows) => {
        if (err) {
            console.error('Error fetching teams:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch teams'
            });
        }

        res.json({
            success: true,
            teams: rows
        });
    });
});

// Get team members
app.get('/api/teams/:id/members', (req, res) => {
    const { id } = req.params;
    
    const sql = `
        SELECT u.id, u.name, u.email, u.company, tm.role, tm.joined_at
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND tm.is_active = 1
        ORDER BY tm.joined_at ASC
    `;
    
    db.all(sql, [id], (err, rows) => {
        if (err) {
            console.error('Error fetching team members:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch team members'
            });
        }

        res.json({
            success: true,
            members: rows
        });
    });
});

// Add member to team
app.post('/api/teams/:id/members', (req, res) => {
    const { id } = req.params;
    const { user_email, role = 'member' } = req.body;
    
    if (!user_email) {
        return res.status(400).json({
            success: false,
            message: 'User email is required'
        });
    }

    // Check if user exists, if not create one
    db.get('SELECT id FROM users WHERE email = ?', [user_email], (err, user) => {
        if (err) {
            console.error('Error checking user:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Database error. Please try again.'
            });
        }

        let userId = null;
        if (user) {
            userId = user.id;
            addMember();
        } else {
            // Create new user first
            db.run('INSERT INTO users (name, email) VALUES (?, ?)', [user_email.split('@')[0], user_email], function(err) {
                if (err) {
                    console.error('Error creating user:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to create user. Please try again.'
                    });
                } else {
                    userId = this.lastID;
                    addMember();
                }
            });
        }

        function addMember() {
            // Add member to team
            const sql = `INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)`;
            
            db.run(sql, [id, userId, role], function(err) {
                if (err) {
                    console.error('Error adding member to team:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to add member to team. Please try again.'
                    });
                }

                if (this.changes === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'User is already a member of this team'
                    });
                }

                res.json({
                    success: true,
                    message: 'Member added to team successfully!'
                });
            });
        }
    });
});

// Check if user has access to team
app.get('/api/teams/:id/access', (req, res) => {
    const { id } = req.params;
    const { user_email } = req.query;
    
    if (!user_email) {
        return res.status(400).json({
            success: false,
            message: 'User email is required'
        });
    }

    const sql = `
        SELECT tm.role
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND u.email = ? AND tm.is_active = 1
    `;
    
    db.get(sql, [id, user_email], (err, row) => {
        if (err) {
            console.error('Error checking team access:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to check team access'
            });
        }

        if (row) {
            res.json({
                success: true,
                hasAccess: true,
                role: row.role
            });
        } else {
            res.json({
                success: true,
                hasAccess: false
            });
        }
    });
});

// Kanban board endpoints
app.get('/api/kanban/tasks', (req, res) => {
    const { team_id, user_email } = req.query;
    
    if (!team_id || !user_email) {
        return res.status(400).json({
            success: false,
            message: 'Team ID and user email are required'
        });
    }

    // First check if user has access to the team
    const accessCheckSql = `
        SELECT tm.role
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND u.email = ? AND tm.is_active = 1
    `;
    
    db.get(accessCheckSql, [team_id, user_email], (err, accessRow) => {
        if (err) {
            console.error('Error checking team access:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to check team access'
            });
        }

        if (!accessRow) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not a member of this team.'
            });
        }

        // If user has access, fetch tasks for the team
        const sql = `
            SELECT 
                kt.*,
                p.name as project_name,
                p.description as project_description,
                u.name as assigned_to_name,
                u.email as assigned_to_email,
                creator.name as created_by_name
            FROM kanban_tasks kt
            LEFT JOIN projects p ON kt.project_id = p.id
            LEFT JOIN users u ON kt.assigned_to = u.id
            LEFT JOIN users creator ON kt.created_by = creator.id
            WHERE p.team_id = ?
            ORDER BY kt.created_at DESC
        `;
        
        db.all(sql, [team_id], (err, rows) => {
            if (err) {
                console.error('Error fetching kanban tasks:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch tasks'
                });
            }

            res.json({
                success: true,
                tasks: rows,
                userRole: accessRow.role
            });
        });
    });
});

app.post('/api/kanban/tasks', (req, res) => {
    const { 
        title, 
        description, 
        priority, 
        status, 
        project_id, 
        assigned_to, 
        due_date, 
        estimated_hours, 
        tags,
        team_id,
        user_email
    } = req.body;
    
    if (!title || !team_id || !user_email) {
        return res.status(400).json({
            success: false,
            message: 'Title, team ID, and user email are required'
        });
    }

    // First check if user has access to the team
    const accessCheckSql = `
        SELECT tm.role
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND u.email = ? AND tm.is_active = 1
    `;
    
    db.get(accessCheckSql, [team_id, user_email], (err, accessRow) => {
        if (err) {
            console.error('Error checking team access:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to check team access'
            });
        }

        if (!accessRow) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not a member of this team.'
            });
        }

        // Validate priority
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const validStatuses = ['todo', 'in-progress', 'done', 'blocked'];
        
        const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
        const taskStatus = validStatuses.includes(status) ? status : 'todo';

        // Get user ID for created_by
        db.get('SELECT id FROM users WHERE email = ?', [user_email], (err, user) => {
            if (err) {
                console.error('Error getting user ID:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to get user information'
                });
            }

            // Determine a project to associate with this team. If client didn't provide
            // project_id, find or create a default project for the team so tasks persist.
            function getOrCreateTeamProject(callback) {
                if (project_id) {
                    return callback(null, project_id);
                }
                const findSql = `SELECT id FROM projects WHERE team_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1`;
                db.get(findSql, [team_id], (findErr, row) => {
                    if (findErr) {
                        console.error('Error finding team project:', findErr.message);
                        return callback(findErr);
                    }
                    if (row && row.id) {
                        return callback(null, row.id);
                    }
                    // Create a default project for this team
                    const name = `Team ${team_id} Project`;
                    const createSql = `INSERT INTO projects (name, description, status, team_id) VALUES (?, ?, 'active', ?)`;
                    db.run(createSql, [name, 'Auto-created project for Kanban tasks', team_id], function(createErr) {
                        if (createErr) {
                            console.error('Error creating team project:', createErr.message);
                            return callback(createErr);
                        }
                        return callback(null, this.lastID);
                    });
                });
            }

            getOrCreateTeamProject((projErr, resolvedProjectId) => {
                if (projErr) {
                    return res.status(500).json({ success: false, message: 'Failed to resolve team project' });
                }

                const sql = `INSERT INTO kanban_tasks 
                            (title, description, priority, status, project_id, assigned_to, due_date, estimated_hours, tags, created_by) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                db.run(sql, [
                    title,
                    description || '',
                    taskPriority,
                    taskStatus,
                    resolvedProjectId,
                    assigned_to || null,
                    due_date || null,
                    estimated_hours || null,
                    tags || null,
                    user.id
                ], function(err) {
                    if (err) {
                        console.error('Error inserting kanban task:', err.message);
                        return res.status(500).json({
                            success: false,
                            message: 'Failed to create task'
                        });
                    }

                    res.json({
                        success: true,
                        message: 'Task created successfully',
                        task: {
                            id: this.lastID,
                            title,
                            description,
                            priority: taskPriority,
                            status: taskStatus,
                            project_id: resolvedProjectId,
                            assigned_to,
                            due_date,
                            estimated_hours,
                            tags,
                            created_by: user.id
                        }
                    });
                });
            });
        });
    });
});

app.put('/api/kanban/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { title, description, priority, status, team_id, user_email } = req.body;
    
    if (!team_id || !user_email) {
        return res.status(400).json({
            success: false,
            message: 'Team ID and user email are required'
        });
    }

    // First check if user has access to the team
    const accessCheckSql = `
        SELECT tm.role
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND u.email = ? AND tm.is_active = 1
    `;
    
    db.get(accessCheckSql, [team_id, user_email], (err, accessRow) => {
        if (err) {
            console.error('Error checking team access:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to check team access'
            });
        }

        if (!accessRow) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not a member of this team.'
            });
        }

        // Check if task belongs to team's project
        const taskCheckSql = `
            SELECT kt.id 
            FROM kanban_tasks kt
            LEFT JOIN projects p ON kt.project_id = p.id
            WHERE kt.id = ? AND p.team_id = ?
        `;
        
        db.get(taskCheckSql, [id, team_id], (err, taskRow) => {
            if (err) {
                console.error('Error checking task ownership:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify task ownership'
                });
            }

            if (!taskRow) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or does not belong to this team'
                });
            }

            const sql = `UPDATE kanban_tasks 
                         SET title = ?, description = ?, priority = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
                         WHERE id = ?`;
            
            db.run(sql, [title, description, priority, status, id], function(err) {
                if (err) {
                    console.error('Error updating kanban task:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to update task'
                    });
                }

                res.json({
                    success: true,
                    message: 'Task updated successfully'
                });
            });
        });
    });
});

app.delete('/api/kanban/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { team_id, user_email } = req.query;
    
    if (!team_id || !user_email) {
        return res.status(400).json({
            success: false,
            message: 'Team ID and user email are required'
        });
    }

    // First check if user has access to the team
    const accessCheckSql = `
        SELECT tm.role
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND u.email = ? AND tm.is_active = 1
    `;
    
    db.get(accessCheckSql, [team_id, user_email], (err, accessRow) => {
        if (err) {
            console.error('Error checking team access:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to check team access'
            });
        }

        if (!accessRow) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not a member of this team.'
            });
        }

        // Check if task belongs to team's project
        const taskCheckSql = `
            SELECT kt.id 
            FROM kanban_tasks kt
            LEFT JOIN projects p ON kt.project_id = p.id
            WHERE kt.id = ? AND p.team_id = ?
        `;
        
        db.get(taskCheckSql, [id, team_id], (err, taskRow) => {
            if (err) {
                console.error('Error checking task ownership:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify task ownership'
                });
            }

            if (!taskRow) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or does not belong to this team'
                });
            }

            const sql = `DELETE FROM kanban_tasks WHERE id = ?`;
            
            db.run(sql, [id], function(err) {
                if (err) {
                    console.error('Error deleting kanban task:', err.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to delete task'
                    });
                }

                res.json({
                    success: true,
                    message: 'Task deleted successfully'
                });
            });
        });
    });
});

// Serve the main HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/kanban', (req, res) => {
    res.sendFile(path.join(__dirname, 'kanban.html'));
});

// Contact page disabled
// app.get('/contact', (req, res) => {
//     res.sendFile(path.join(__dirname, 'contact.html'));
// });

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/teams', (req, res) => {
    res.sendFile(path.join(__dirname, 'teams.html'));
});

// Additional structured data endpoints

// Users management
app.get('/api/users', (req, res) => {
    const sql = `SELECT id, name, email, phone, company, role, created_at, is_active FROM users ORDER BY created_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch users'
            });
        }

        res.json({
            success: true,
            users: rows
        });
    });
});

// Projects management
app.get('/api/projects', (req, res) => {
    const sql = `
        SELECT 
            p.*,
            creator.name as created_by_name,
            COUNT(kt.id) as task_count
        FROM projects p
        LEFT JOIN users creator ON p.created_by = creator.id
        LEFT JOIN kanban_tasks kt ON p.id = kt.project_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching projects:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch projects'
            });
        }

        res.json({
            success: true,
            projects: rows
        });
    });
});

// Dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
    const queries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
        totalMessages: 'SELECT COUNT(*) as count FROM contact_messages',
        totalTasks: 'SELECT COUNT(*) as count FROM kanban_tasks',
        totalProjects: 'SELECT COUNT(*) as count FROM projects WHERE status = "active"',
        tasksByStatus: `
            SELECT status, COUNT(*) as count 
            FROM kanban_tasks 
            GROUP BY status
        `,
        messagesByType: `
            SELECT message_type, COUNT(*) as count 
            FROM contact_messages 
            GROUP BY message_type
        `,
        recentMessages: `
            SELECT cm.*, u.name as user_name 
            FROM contact_messages cm
            LEFT JOIN users u ON cm.user_id = u.id
            ORDER BY cm.created_at DESC 
            LIMIT 5
        `,
        recentTasks: `
            SELECT kt.*, p.name as project_name 
            FROM kanban_tasks kt
            LEFT JOIN projects p ON kt.project_id = p.id
            ORDER BY kt.created_at DESC 
            LIMIT 5
        `
    };

    const results = {};
    let completedQueries = 0;
    const totalQueries = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.all(queries[key], [], (err, rows) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err.message);
                results[key] = [];
            } else {
                results[key] = rows;
            }
            
            completedQueries++;
            if (completedQueries === totalQueries) {
                res.json({
                    success: true,
                    stats: results
                });
            }
        });
    });
});

// Socket.IO WhatsApp-style Chat functionality
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Handle user joining
    socket.on('join-user', (data) => {
        socket.userId = data.userId;
        socket.username = data.username;
        socket.join(`user_${data.userId}`);
        
        // Notify others that user is online
        socket.broadcast.emit('user-online', {
            userId: data.userId,
            username: data.username
        });
        
        console.log(`${data.username} joined as user`);
    });
    
    // Handle joining a chat
    socket.on('join-chat', (data) => {
        const roomName = data.chatType === 'group' ? `group_${data.chatId}` : `chat_${data.chatId}`;
        socket.join(roomName);
        socket.currentChat = data.chatId;
        socket.currentChatType = data.chatType;
        
        console.log(`${socket.username} joined ${data.chatType} chat: ${data.chatId}`);
    });
    
    // Handle sending messages
    socket.on('send-message', (data) => {
        const roomName = data.group_id ? `group_${data.group_id}` : `chat_${data.receiver_id}`;
        
        // Broadcast to all users in the chat
        socket.to(roomName).emit('new-message', {
            id: data.messageId,
            sender_id: data.sender_id,
            receiver_id: data.receiver_id,
            group_id: data.group_id,
            message: data.message,
            message_type: data.message_type,
            timestamp: data.timestamp,
            sender_name: socket.username
        });
        
        // Mark as delivered for sender
        socket.emit('message-delivered', { messageId: data.messageId });
        
        console.log(`Message sent in ${roomName} by ${socket.username}`);
    });
    
    // Handle typing indicators
    socket.on('typing', (data) => {
        const roomName = data.chatType === 'group' ? `group_${data.chatId}` : `chat_${data.chatId}`;
        
        socket.to(roomName).emit('user-typing', {
            userId: data.userId,
            username: data.username,
            isTyping: data.isTyping
        });
    });
    
    // Handle message delivery confirmation
    socket.on('message-delivered', (data) => {
        // Update database
        db.run('UPDATE chat_messages SET is_delivered = 1 WHERE id = ?', [data.messageId]);
        
        // Notify sender
        socket.emit('message-delivered', { messageId: data.messageId });
    });
    
    // Handle message read confirmation
    socket.on('message-read', (data) => {
        // Update database
        db.run('UPDATE chat_messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?', [data.messageId]);
        
        // Notify sender
        socket.emit('message-read', { messageId: data.messageId });
    });
    
    // Handle group creation
    socket.on('create-group', (data) => {
        socket.broadcast.emit('group-created', {
            group: data.group
        });
    });
    
    // Handle user disconnect
    socket.on('disconnect', () => {
        if (socket.userId) {
            // Notify others that user is offline
            socket.broadcast.emit('user-offline', {
                userId: socket.userId,
                username: socket.username
            });
            console.log(`${socket.username} disconnected`);
        }
    });
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.session.token || req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token.' });
    }
}

// Password validation
function validatePassword(password) {
    const minLength = 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    return {
        isValid: password.length >= minLength && hasLetter && hasNumber,
        errors: [
            ...(password.length < minLength ? ['Password must be at least 8 characters long'] : []),
            ...(!hasLetter ? ['Password must contain at least one letter'] : []),
            ...(!hasNumber ? ['Password must contain at least one number'] : [])
        ]
    };
}

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Send registration confirmation email
async function sendRegistrationConfirmation(email, username) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: 'Welcome to Remote Work Management Platform!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #007bff;">Welcome to Our Platform!</h2>
                    <p>Hello ${username},</p>
                    <p>You have successfully registered on the Remote Work Management Platform.</p>
                    <p><strong>Account Details:</strong></p>
                    <ul>
                        <li>Username: ${username}</li>
                        <li>Email: ${email}</li>
                        <li>Registration Time: ${new Date().toLocaleString()}</li>
                    </ul>
                    <p>You can now log in and start using all the features including:</p>
                    <ul>
                        <li>📋 Kanban Board for task management</li>
                        <li>💬 Real-time chat with your team</li>
                        <li>👥 Team collaboration tools</li>
                    </ul>
                    <p>Thank you for joining us!</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #6c757d; font-size: 12px;">
                        This is an automated message from Remote Work Management Platform.
                    </p>
                </div>
            `
        };
        
        await emailTransporter.sendMail(mailOptions);
        console.log(`Registration confirmation sent to ${email}`);
    } catch (error) {
        console.error('Error sending registration confirmation:', error);
    }
}

// Send email notification
async function sendLoginNotification(email, username) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: 'Login Confirmation - Remote Work Management Platform',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #007bff;">Login Confirmation</h2>
                    <p>Hello ${username},</p>
                    <p>You have successfully logged into your account on the Remote Work Management Platform.</p>
                    <p><strong>Login Details:</strong></p>
                    <ul>
                        <li>Username: ${username}</li>
                        <li>Email: ${email}</li>
                        <li>Login Time: ${new Date().toLocaleString()}</li>
                    </ul>
                    <p>If you did not perform this login, please contact support immediately.</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #6c757d; font-size: 12px;">
                        This is an automated message from Remote Work Management Platform.
                    </p>
                </div>
            `
        };
        
        await emailTransporter.sendMail(mailOptions);
        console.log(`Login notification sent to ${email}`);
    } catch (error) {
        console.error('Error sending email notification:', error);
    }
}

// Send password reset email
async function sendPasswordResetEmail(email, link, minutes) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: 'Reset your password',
            html: `
                <p>Click the link below to reset your password. This link expires in ${minutes} minutes.</p>
                <p><a href="${link}">${link}</a></p>
                <p>If you did not request this, you can ignore this email.</p>
            `
        };
        await emailTransporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
}

// Organization management routes

// Invite employee to organization
app.post('/api/organizations/invite', async (req, res) => {
    try {
        const { email, organizationId } = req.body;
        
        if (!email || !organizationId) {
            return res.status(400).json({ error: 'Email and organization ID are required' });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // Check if organization exists
        db.get('SELECT * FROM organizations WHERE id = ?', [organizationId], (err, org) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!org) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            
            // Check if user already exists
            db.get('SELECT * FROM auth_users WHERE email = ?', [email], async (err, existingUser) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingUser) {
                    return res.status(400).json({ error: 'User with this email already exists' });
                }
                
                // Create pending user
                const inviteToken = jwt.sign({ email, organizationId }, JWT_SECRET, { expiresIn: '7d' });
                const username = email.split('@')[0];
                
                db.run(
                    'INSERT INTO auth_users (username, email, password_hash, organization_id, role, status, invited_by, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [username, email, '', organizationId, 'employee', 'pending', org.admin_email, inviteToken],
                    async (err) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        
                        // Send invitation email
                        try {
                            await emailTransporter.sendMail({
                                from: process.env.EMAIL_USER || 'your-email@gmail.com',
                                to: email,
                                subject: `Invitation to join ${org.name}`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                        <h2 style="color: #007bff;">You're invited to join ${org.name}!</h2>
                                        <p>Hello,</p>
                                        <p>You have been invited to join <strong>${org.name}</strong> on the Remote Work Management Platform.</p>
                                        <p>To complete your registration, please click the link below:</p>
                                        <a href="http://localhost:3000/register-employee.html?token=${inviteToken}" 
                                           style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                                            Complete Registration
                                        </a>
                                        <p>This invitation will expire in 7 days.</p>
                                        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                                    </div>
                                `
                            });
                            
                            res.json({ message: 'Invitation sent successfully' });
                        } catch (emailError) {
                            console.error('Email error:', emailError);
                            res.status(500).json({ error: 'Failed to send invitation email' });
                        }
                    }
                );
            });
        });
    } catch (error) {
        console.error('Error inviting employee:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Complete employee registration
app.post('/api/auth/register-employee', async (req, res) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        
        const { email, organizationId } = decoded;
        
        // Find pending user
        db.get('SELECT * FROM auth_users WHERE email = ? AND status = ?', [email, 'pending'], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'User not found or already registered' });
            }
            
            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            // Update user with password and approve
            db.run(
                'UPDATE auth_users SET password_hash = ?, status = ? WHERE email = ?',
                [hashedPassword, 'approved', email],
                (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    res.json({ message: 'Registration completed successfully' });
                }
            );
        });
    } catch (error) {
        console.error('Error completing employee registration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get organization users
app.get('/api/organizations/users', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        db.all(
            'SELECT username, email, role, status, created_at FROM auth_users WHERE organization_id = ? ORDER BY created_at DESC',
            [decoded.organizationId],
            (err, users) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                res.json(users);
            }
        );
    } catch (error) {
        console.error('Error getting organization users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register new organization
app.post('/api/organizations/register', async (req, res) => {
    try {
        const { organizationName, adminEmail, adminPassword, industry } = req.body;
        
        // Validation
        if (!organizationName || !adminEmail || !adminPassword) {
            return res.status(400).json({ error: 'Organization name, admin email, and password are required' });
        }
        
        if (!validateEmail(adminEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        const passwordValidation = validatePassword(adminPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                error: 'Password validation failed', 
                details: passwordValidation.errors 
            });
        }
        
        // Check if organization already exists
        db.get('SELECT id FROM organizations WHERE name = ? OR admin_email = ?', [organizationName, adminEmail], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (row) {
                return res.status(400).json({ error: 'Organization name or admin email already exists' });
            }
            
            // Create organization
            db.run(
                'INSERT INTO organizations (name, admin_email, industry) VALUES (?, ?, ?)',
                [organizationName, adminEmail, industry || null],
                function(err) {
                    if (err) {
                        console.error('Error creating organization:', err);
                        return res.status(500).json({ error: 'Error creating organization' });
                    }
                    
                    const organizationId = this.lastID;
                    
                    // Create admin user
                    createAdminUser(req, organizationId, adminEmail, adminPassword, organizationName, res);
                }
            );
        });
    } catch (error) {
        console.error('Organization registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to create admin user
async function createAdminUser(req, organizationId, adminEmail, adminPassword, organizationName, res) {
    try {
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
        
        // Generate username from email
        const username = adminEmail.split('@')[0];
        
        // Create admin user
        db.run(
            'INSERT INTO auth_users (username, email, password_hash, organization_id, role, department, position, status, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [username, adminEmail, passwordHash, organizationId, 'admin', 'Administration', 'Organization Admin', 'approved', 1],
            function(err) {
                if (err) {
                    console.error('Error creating admin user:', err);
                    return res.status(500).json({ error: 'Error creating admin user' });
                }
                
                // Generate JWT token
                const token = jwt.sign(
                    { 
                        userId: this.lastID, 
                        username: username, 
                        email: adminEmail,
                        organizationId: organizationId,
                        role: 'admin'
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                // Store token in session
                req.session.token = token;
                req.session.userId = this.lastID;
                
                // Send registration confirmation email
                sendOrganizationWelcomeEmail(adminEmail, username, organizationName);
                
                res.status(201).json({ 
                    message: 'Organization registered successfully',
                    organizationId: organizationId,
                    userId: this.lastID,
                    token: token,
                    user: {
                        id: this.lastID,
                        username: username,
                        email: adminEmail,
                        role: 'admin',
                        organizationId: organizationId
                    }
                });
            }
        );
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({ error: 'Error creating admin user' });
    }
}

// Send organization welcome email
async function sendOrganizationWelcomeEmail(email, username, organizationName) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: `Welcome to ${organizationName} - Organization Setup Complete`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #007bff;">Welcome to ${organizationName}!</h2>
                    <p>Hello ${username},</p>
                    <p>Your organization <strong>${organizationName}</strong> has been successfully registered on the Remote Work Management Platform.</p>
                    <p><strong>Organization Details:</strong></p>
                    <ul>
                        <li>Organization: ${organizationName}</li>
                        <li>Admin Email: ${email}</li>
                        <li>Registration Time: ${new Date().toLocaleString()}</li>
                    </ul>
                    <p>As an organization admin, you can now:</p>
                    <ul>
                        <li>👥 Invite employees to join your organization</li>
                        <li>🏢 Create teams and departments</li>
                        <li>💬 Set up organization-wide chat channels</li>
                        <li>📋 Manage projects and tasks</li>
                        <li>⚙️ Configure organization settings</li>
                    </ul>
                    <p>You can now log in and start building your team!</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #6c757d; font-size: 12px;">
                        This is an automated message from Remote Work Management Platform.
                    </p>
                </div>
            `
        };
        
        await emailTransporter.sendMail(mailOptions);
        console.log(`Organization welcome email sent to ${email}`);
    } catch (error) {
        console.error('Error sending organization welcome email:', error);
    }
}

// Get organization users (for admin)
app.get('/api/organizations/users', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get user's organization
    db.get('SELECT organization_id, role FROM auth_users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get all users in the organization
        db.all(`
            SELECT id, username, email, role, department, position, created_at, last_login, is_active
            FROM auth_users 
            WHERE organization_id = ? AND is_active = 1
            ORDER BY role DESC, created_at ASC
        `, [user.organization_id], (err, rows) => {
            if (err) {
                console.error('Error fetching organization users:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(rows);
        });
    });
});

// Invite user to organization
app.post('/api/organizations/invite', (req, res) => {
    const { email, department, position } = req.body;
    const userId = req.session.userId;
    
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Check if user is admin
    db.get('SELECT organization_id, role FROM auth_users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // Check if email already exists
        db.get('SELECT id FROM auth_users WHERE email = ?', [email], (err, existingUser) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingUser) {
                return res.status(400).json({ error: 'User with this email already exists' });
            }
            
            // Create invitation (for now, just return success - in production, you'd send an email)
            res.json({ 
                message: 'Invitation sent successfully',
                email: email,
                department: department,
                position: position
            });
        });
    });
});

// Authentication routes
// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                error: 'Password validation failed', 
                details: passwordValidation.errors 
            });
        }
        
        // Check if user already exists
        db.get('SELECT id FROM auth_users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (row) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }
            
            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
            // Generate verification token
            const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
            
            // Insert new user
            db.run(
                'INSERT INTO auth_users (username, email, password_hash, verification_token) VALUES (?, ?, ?, ?)',
                [username, email, passwordHash, verificationToken],
                function(err) {
                    if (err) {
                        console.error('Error creating user:', err);
                        return res.status(500).json({ error: 'Error creating user' });
                    }
                    
                    res.status(201).json({ 
                        message: 'User registered successfully',
                        userId: this.lastID 
                    });
                    
                    // Send registration confirmation email
                    sendRegistrationConfirmation(email, username);
                }
            );
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { login, password } = req.body; // login can be username or email
        
        if (!login || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }
        
        // Find user by username or email
        db.get(
            'SELECT au.*, o.name as organization_name FROM auth_users au LEFT JOIN organizations o ON au.organization_id = o.id WHERE (au.username = ? OR au.email = ?) AND au.is_active = 1',
            [login, login],
            async (err, user) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (!user) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
                
                // Check if user is approved (for employees)
                if (user.role === 'employee' && user.status !== 'approved') {
                    return res.status(403).json({ 
                        error: 'Access not granted. Please contact your organisation admin.' 
                    });
                }
                
                // Verify password
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                if (!isValidPassword) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
                
                // Generate JWT token
                const token = jwt.sign(
                    { 
                        userId: user.id, 
                        username: user.username, 
                        email: user.email,
                        organizationId: user.organization_id,
                        role: user.role
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                // Update last login
                db.run(
                    'UPDATE auth_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [user.id]
                );
                
                // Store token in session
                req.session.token = token;
                req.session.userId = user.id;
                
                // Send login notification email
                await sendLoginNotification(user.email, user.username);
                
                res.json({
                    message: 'Login successful',
                    token: token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        department: user.department,
                        position: user.position,
                        organizationId: user.organization_id,
                        organizationName: user.organization_name
                    }
                });
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// Forgot Password (neutral response)
app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body || {};
    const ttl = PASSWORD_RESET_TTL_MINUTES;
    const resetBase = `http://localhost:${PORT}/reset-password.html`;

    db.get('SELECT id, email FROM auth_users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email], (err, user) => {
        if (!err && user) {
            try {
                const crypto = require('crypto');
                const rawToken = crypto.randomBytes(32).toString('hex');
                const tokenHash = crypto.createHmac('sha256', PASSWORD_RESET_SECRET).update(rawToken).digest('hex');
                const expiresAt = new Date(Date.now() + ttl * 60 * 1000).toISOString();
                db.run('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, tokenHash, expiresAt]);
                const url = `${resetBase}?token=${encodeURIComponent(rawToken)}`;
                sendPasswordResetEmail(user.email, url, ttl).catch(() => {});
            } catch (_) { /* ignore */ }
        }
        // Always neutral response
        return res.status(200).json({ message: 'If the email exists, a reset link was sent.' });
    });
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Invalid request' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
        const crypto = require('crypto');
        const tokenHash = crypto.createHmac('sha256', PASSWORD_RESET_SECRET).update(token).digest('hex');
        db.get(
            'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
            [tokenHash],
            async (err, row) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (!row) return res.status(400).json({ error: 'Invalid or expired token' });

                try {
                    const hashed = await bcrypt.hash(password, 10);
                    db.run('UPDATE auth_users SET password_hash = ? WHERE id = ?', [hashed, row.user_id], (uErr) => {
                        if (uErr) return res.status(500).json({ error: 'Failed to update password' });
                        db.run('UPDATE password_resets SET used = 1 WHERE id = ?', [row.id]);
                        return res.json({ message: 'Password updated. You can now login.' });
                    });
                } catch (_) {
                    return res.status(500).json({ error: 'Failed to update password' });
                }
            }
        );
    } catch (_) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }
});

// Check authentication status
app.get('/api/auth/status', authenticateToken, (req, res) => {
    res.json({
        authenticated: true,
        user: req.user
    });
});

// Protected route middleware for pages
function requireAuth(req, res, next) {
    const token = req.session.token;
    
    if (!token) {
        return res.redirect('/?error=Please login to access this page');
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.redirect('/?error=Session expired. Please login again.');
    }
}

// WhatsApp-style Chat API endpoints

// Get all users for contacts (organization-specific)
app.get('/api/users', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get user's organization
    db.get('SELECT organization_id FROM auth_users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get all users in the same organization (excluding current user)
        db.all(`
            SELECT id, username, email, role, department, position 
            FROM auth_users 
            WHERE organization_id = ? AND id != ? AND is_active = 1
            ORDER BY username ASC
        `, [user.organization_id, userId], (err, rows) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }
            res.json(rows);
        });
    });
});

// Get user's groups (organization-specific)
app.get('/api/chat/groups', (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get user's organization
    db.get('SELECT organization_id FROM auth_users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        db.all(`
            SELECT cg.*, COUNT(gm.user_id) as memberCount
            FROM chat_groups cg
            LEFT JOIN group_members gm ON cg.id = gm.group_id
            WHERE cg.organization_id = ? AND cg.id IN (
                SELECT group_id FROM group_members WHERE user_id = ?
            ) AND cg.is_active = 1
            GROUP BY cg.id
            ORDER BY cg.created_at DESC
        `, [user.organization_id, userId], (err, rows) => {
            if (err) {
                console.error('Error fetching groups:', err);
                return res.status(500).json({ error: 'Failed to fetch groups' });
            }
            res.json(rows);
        });
    });
});

// Get messages for a chat (user or group)
app.get('/api/chat/messages/:chatId', (req, res) => {
    const { chatId } = req.params;
    const { type } = req.query; // 'user' or 'group'
    const userId = req.session.userId;
    
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    let query, params;
    
    if (type === 'group') {
        query = `
            SELECT cm.*, au.username as sender_name
            FROM chat_messages cm
            JOIN auth_users au ON cm.sender_id = au.id
            WHERE cm.group_id = ?
            ORDER BY cm.timestamp ASC
        `;
        params = [chatId];
    } else {
        query = `
            SELECT cm.*, au.username as sender_name
            FROM chat_messages cm
            JOIN auth_users au ON cm.sender_id = au.id
            WHERE (cm.sender_id = ? AND cm.receiver_id = ?) 
               OR (cm.sender_id = ? AND cm.receiver_id = ?)
            ORDER BY cm.timestamp ASC
        `;
        params = [userId, chatId, chatId, userId];
    }
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ error: 'Failed to fetch messages' });
        }
        res.json(rows);
    });
});

// Send a message
app.post('/api/chat/send-message', (req, res) => {
    const { sender_id, receiver_id, group_id, message, message_type } = req.body;
    const userId = req.session.userId;
    
    if (!userId || userId !== sender_id) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const timestamp = new Date().toISOString();
    
    db.run(`
        INSERT INTO chat_messages (sender_id, receiver_id, group_id, message, message_type, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [sender_id, receiver_id, group_id, message, message_type, timestamp], function(err) {
        if (err) {
            console.error('Error sending message:', err);
            return res.status(500).json({ error: 'Failed to send message' });
        }
        
        res.json({
            messageId: this.lastID,
            timestamp: timestamp
        });
    });
});

// Mark messages as read
app.post('/api/chat/mark-read', (req, res) => {
    const { chatId, chatType, userId } = req.body;
    
    if (!req.session.userId || req.session.userId !== userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    let query, params;
    
    if (chatType === 'group') {
        query = `
            UPDATE chat_messages 
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE group_id = ? AND sender_id != ? AND is_read = 0
        `;
        params = [chatId, userId];
    } else {
        query = `
            UPDATE chat_messages 
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
        `;
        params = [chatId, userId];
    }
    
    db.run(query, params, (err) => {
        if (err) {
            console.error('Error marking messages as read:', err);
            return res.status(500).json({ error: 'Failed to mark messages as read' });
        }
        res.json({ success: true });
    });
});

// Create a group (organization-specific)
app.post('/api/chat/create-group', (req, res) => {
    const { name, createdBy } = req.body;
    
    if (!req.session.userId || req.session.userId !== createdBy) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get user's organization
    db.get('SELECT organization_id FROM auth_users WHERE id = ?', [createdBy], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        db.run(`
            INSERT INTO chat_groups (name, organization_id, created_by)
            VALUES (?, ?, ?)
        `, [name, user.organization_id, createdBy], function(err) {
            if (err) {
                console.error('Error creating group:', err);
                return res.status(500).json({ error: 'Failed to create group' });
            }
            
            const groupId = this.lastID;
            
            // Add creator as admin member
            db.run(`
                INSERT INTO group_members (group_id, user_id, is_admin)
                VALUES (?, ?, 1)
            `, [groupId, createdBy], (err) => {
                if (err) {
                    console.error('Error adding creator to group:', err);
                    return res.status(500).json({ error: 'Failed to add creator to group' });
                }
                
                res.json({
                    id: groupId,
                    name: name,
                    organization_id: user.organization_id,
                    created_by: createdBy,
                    memberCount: 1
                });
            });
        });
    });
});

// Upload file
app.post('/api/chat/upload-file', (req, res) => {
    // File upload implementation would go here
    // For now, just return success
    res.json({ success: true, message: 'File upload feature coming soon' });
});

// Legacy chat API endpoints (for backward compatibility)
// Get chat history for a room
app.get('/api/chat/:room/messages', (req, res) => {
    const { room } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    db.all(`
        SELECT username, message, timestamp, message_type, is_system_message
        FROM chat_messages 
        WHERE room = ? 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
    `, [room, parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) {
            console.error('Error fetching chat messages:', err);
            return res.status(500).json({ error: 'Failed to fetch chat messages' });
        }
        
        res.json(rows.reverse()); // Reverse to show oldest first
    });
});

// Get online users in a room
app.get('/api/chat/:room/users', (req, res) => {
    const { room } = req.params;
    const roomSockets = io.sockets.adapter.rooms.get(room);
    
    if (!roomSockets) {
        return res.json([]);
    }
    
    const users = [];
    roomSockets.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.username) {
            users.push({
                username: socket.username,
                socketId: socketId
            });
        }
    });
    
    res.json(users);
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  POST /api/contact - Submit contact form');
    console.log('  GET  /api/contact - Get all messages (admin)');
    console.log('  POST /api/teams - Create new team');
    console.log('  GET  /api/teams - Get user teams');
    console.log('  GET  /api/teams/:id/members - Get team members');
    console.log('  POST /api/teams/:id/members - Add team member');
    console.log('  GET  /api/teams/:id/access - Check team access');
    console.log('  GET  /api/users - Get all users');
    console.log('  GET  /api/projects - Get all projects');
    console.log('  GET  /api/dashboard/stats - Get dashboard statistics');
    console.log('  GET  /api/kanban/tasks - Get team tasks');
    console.log('  POST /api/kanban/tasks - Create new task');
    console.log('  PUT  /api/kanban/tasks/:id - Update task');
    console.log('  DELETE /api/kanban/tasks/:id - Delete task');
    console.log('  GET  /api/chat/:room/messages - Get chat history');
    console.log('  GET  /api/chat/:room/users - Get online users');
    console.log('  WebSocket / - Live chat functionality');
    console.log('  POST /api/auth/register - Register new user');
    console.log('  POST /api/auth/login - Login user');
    console.log('  POST /api/auth/logout - Logout user');
    console.log('  GET  /api/auth/status - Check authentication status');
    console.log('  POST /api/organizations/register - Register new organization');
    console.log('  GET  /api/organizations/users - Get organization users');
    console.log('  POST /api/organizations/invite - Invite user to organization');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
