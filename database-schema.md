# Database Schema Documentation

## Overview
This document describes the structured database schema for the SaaS website with Kanban board and contact form functionality.

## Database Tables

### 1. Users Table
Stores user information for better data organization and relationships.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique user identifier |
| name | TEXT | NOT NULL | User's full name |
| email | TEXT | UNIQUE, NOT NULL | User's email address |
| phone | TEXT | | User's phone number |
| company | TEXT | | User's company name |
| role | TEXT | DEFAULT 'user' | User role (user, admin, manager) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |
| is_active | BOOLEAN | DEFAULT 1 | Account status |

### 2. Projects Table
Organizes tasks into projects for better management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique project identifier |
| name | TEXT | NOT NULL | Project name |
| description | TEXT | | Project description |
| status | TEXT | DEFAULT 'active' | Project status (active, completed, on-hold) |
| created_by | INTEGER | FOREIGN KEY | User who created the project |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Project creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### 3. Contact Messages Table
Enhanced contact form submissions with structured data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique message identifier |
| user_id | INTEGER | FOREIGN KEY | Associated user (if exists) |
| name | TEXT | NOT NULL | Contact person's name |
| email | TEXT | NOT NULL | Contact person's email |
| subject | TEXT | | Message subject |
| message | TEXT | NOT NULL | Message content |
| message_type | TEXT | DEFAULT 'general' | Type (general, support, sales, feedback, bug_report) |
| priority | TEXT | DEFAULT 'medium' | Priority level (low, medium, high, urgent) |
| status | TEXT | DEFAULT 'new' | Message status (new, in-progress, resolved, closed) |
| assigned_to | INTEGER | FOREIGN KEY | User assigned to handle the message |
| response | TEXT | | Response to the message |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Message creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### 4. Kanban Tasks Table
Enhanced task management with project organization and user assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique task identifier |
| project_id | INTEGER | FOREIGN KEY | Associated project |
| title | TEXT | NOT NULL | Task title |
| description | TEXT | | Task description |
| priority | TEXT | DEFAULT 'medium' | Priority (low, medium, high, urgent) |
| status | TEXT | DEFAULT 'todo' | Status (todo, in-progress, done, blocked) |
| assigned_to | INTEGER | FOREIGN KEY | User assigned to the task |
| due_date | DATETIME | | Task due date |
| estimated_hours | DECIMAL(5,2) | | Estimated hours to complete |
| actual_hours | DECIMAL(5,2) | | Actual hours spent |
| tags | TEXT | | Comma-separated tags |
| created_by | INTEGER | FOREIGN KEY | User who created the task |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Task creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### 5. Task Comments Table
Stores comments and discussions for tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique comment identifier |
| task_id | INTEGER | NOT NULL, FOREIGN KEY | Associated task |
| user_id | INTEGER | NOT NULL, FOREIGN KEY | User who made the comment |
| comment | TEXT | NOT NULL | Comment content |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Comment timestamp |

## Relationships

### Foreign Key Relationships
- `contact_messages.user_id` → `users.id`
- `contact_messages.assigned_to` → `users.id`
- `projects.created_by` → `users.id`
- `kanban_tasks.project_id` → `projects.id`
- `kanban_tasks.assigned_to` → `users.id`
- `kanban_tasks.created_by` → `users.id`
- `task_comments.task_id` → `kanban_tasks.id`
- `task_comments.user_id` → `users.id`

## Indexes
For optimal performance, the following indexes are created:

- `idx_contact_messages_email` on `contact_messages(email)`
- `idx_contact_messages_status` on `contact_messages(status)`
- `idx_contact_messages_created_at` on `contact_messages(created_at)`
- `idx_kanban_tasks_status` on `kanban_tasks(status)`
- `idx_kanban_tasks_project_id` on `kanban_tasks(project_id)`
- `idx_kanban_tasks_assigned_to` on `kanban_tasks(assigned_to)`
- `idx_kanban_tasks_priority` on `kanban_tasks(priority)`
- `idx_users_email` on `users(email)`
- `idx_projects_status` on `projects(status)`

## Data Validation

### Contact Messages
- **Message Types**: general, support, sales, feedback, bug_report
- **Priorities**: low, medium, high, urgent
- **Statuses**: new, in-progress, resolved, closed

### Kanban Tasks
- **Priorities**: low, medium, high, urgent
- **Statuses**: todo, in-progress, done, blocked
- **Estimated Hours**: Decimal with 2 decimal places (max 999.99)

### Users
- **Roles**: user, admin, manager
- **Email**: Must be unique and valid format

## API Endpoints

### Contact Management
- `POST /api/contact` - Submit contact form
- `GET /api/contact` - Get all messages with user details

### User Management
- `GET /api/users` - Get all users

### Project Management
- `GET /api/projects` - Get all projects with task counts

### Task Management
- `GET /api/kanban/tasks` - Get all tasks with project and user details
- `POST /api/kanban/tasks` - Create new task
- `PUT /api/kanban/tasks/:id` - Update task
- `DELETE /api/kanban/tasks/:id` - Delete task

### Dashboard
- `GET /api/dashboard/stats` - Get comprehensive statistics

## Benefits of This Structure

1. **Data Normalization**: Eliminates redundancy and ensures data consistency
2. **Relationships**: Proper foreign key relationships maintain data integrity
3. **Scalability**: Structure supports growth and additional features
4. **Performance**: Indexes optimize query performance
5. **Flexibility**: Easy to add new fields and relationships
6. **Reporting**: Structured data enables comprehensive analytics
7. **User Management**: Centralized user data with role-based access
8. **Project Organization**: Tasks organized by projects for better management
