# BlahBlah

## Real-Time Chat Application

A full-stack real-time chat application with user authentication and persistent messaging. Built using Next.js for the frontend and Express with Socket.IO for the backend.

## Live Demo

**Access the application here**: [https://blah-blah-omega.vercel.app](https://blah-blah-omega.vercel.app)

## Project Structure

```
chat-app/
├── chat-backend/        # Backend server (Node.js + Express + Socket.IO)
│   ├── index.js         # Main server file
│   ├── package.json     # Backend dependencies
│   └── .gitignore
│
├── chat-frontend/       # Frontend (Next.js)
│   ├── pages/
│   │   ├── index.js     # Login / Register UI
│   │   ├── chat.js      # Chat interface
│   │   └── _app.js      # App layout and global styles
│   ├── package.json     # Frontend dependencies
│   ├── next.config.js   # Next.js config
│   ├── .gitignore
│   └── README.md
```

## Features

- User registration and login  
- Real-time one-to-one chat using WebSockets  
- Persistent chat session per user  
- Simple, responsive UI  
- Easily deployable on platforms like Vercel and Render  

## Technologies Used

### Frontend

- Next.js (React Framework)  
- Axios (for API requests)  
- CSS Modules or Tailwind CSS (based on your setup)  

### Backend

- Node.js with Express  
- Socket.IO for real-time communication  
- CORS and body-parser for request handling  

## Deployment

- Frontend can be deployed to [Vercel](https://vercel.com/)  
- Backend can be deployed to [Render](https://render.com/) 
