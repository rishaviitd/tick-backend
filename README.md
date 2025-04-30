# Crita Backend

This is the backend API server for Crita, an assessment platform for educators. The server provides API endpoints for teacher authentication, classroom management, student management, and assignment creation.

## Project Structure

The codebase follows a modular architecture for better maintainability and scalability:

```
backend/
├── config/            # Configuration files
│   ├── database.js    # Database connection
│   └── env.js         # Environment variables
├── controllers/       # Request handlers
│   ├── authController.js       # Authentication logic
│   ├── teacherController.js    # Teacher management
│   ├── classController.js      # Class management
│   └── assignmentController.js # Assignment handling
├── middleware/        # Middleware functions
│   └── authMiddleware.js       # JWT authentication
├── models/            # Mongoose schemas
│   ├── teacherModel.js         # Teacher data model
│   ├── classModel.js           # Class data model
│   ├── studentModel.js         # Student data model
│   ├── assignmentModel.js      # Assignment data model
│   └── questionModel.js        # Question data model
├── routes/            # API route definitions
│   ├── authRoutes.js           # Authentication routes
│   ├── teacherRoutes.js        # Teacher routes
│   ├── classRoutes.js          # Class routes
│   └── assignmentRoutes.js     # Assignment routes
├── utils/             # Utility functions
└── server.js          # Entry point
```

## Key Features

- **Authentication**: Email/password and Google OAuth authentication
- **Class Management**: Create classes and add students
- **Assignment Creation**: Create assignments with questions
- **Draft Management**: Save and manage assignment drafts

## API Endpoints

### Authentication

- POST `/api/v1/auth/signup` - Register a new teacher
- POST `/api/v1/auth/login` - Login with email/password
- GET `/api/v1/auth/google` - Initiate Google OAuth flow
- GET `/api/v1/auth/verify` - Verify JWT token validity

### Teachers

- GET `/api/v1/teachers` - Get all teachers
- GET `/api/v1/teachers/:id` - Get teacher by ID
- POST `/api/v1/teachers` - Create a teacher

### Classes

- GET `/api/v1/classes` - Get classes for a teacher
- POST `/api/v1/classes` - Create a new class with students
- GET `/api/v1/classes/students` - Get students in a class

### Assignments

- POST `/api/v1/assignments` - Create an assignment
- POST `/api/v1/assignments/drafts` - Save assignment draft
- GET `/api/v1/assignments/drafts` - Get all drafts for a teacher
- GET `/api/v1/assignments/drafts/:title` - Get draft by title
- DELETE `/api/v1/assignments/drafts/:title` - Delete a draft

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env` file with the required environment variables
4. Run the server with `npm start` or `npm run dev` for development

## Environment Variables

Required environment variables:

- `PORT` - Server port (default: 3000)
- `DATABASE` - MongoDB connection string
- `DATABASE_PASSWORD` - MongoDB password
- `JWT_SECRET` - Secret for JWT token generation
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `FRONTEND_URL` - Frontend URL for redirects
- `APP_URL` - App URL for OAuth callbacks
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI
