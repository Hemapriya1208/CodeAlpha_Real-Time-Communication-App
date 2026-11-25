# Real-Time Communication App

## Project Overview

A full-stack real-time communication platform designed for seamless online collaboration. Users can register and securely log in, create or join meeting rooms, communicate through real-time video and audio, exchange messages and files, share their screens, and collaborate using a shared whiteboard.

## Features

- User Registration & Login
- Secure JWT Authentication
- Create & Join Meeting Rooms
- Real-Time Video & Audio Calling
- Real-Time Chat
- File Sharing
- Screen Sharing
- Collaborative Whiteboard
- Microphone & Camera Controls
- Multi-User Meetings
- Leave Meeting & Return to Dashboard

## Technologies Used

**Frontend:** HTML, CSS, JavaScript, WebRTC  
**Backend:** Node.js, Express.js, Socket.IO  
**Authentication:** JWT, bcrypt.js  
**File Upload:** Multer

## Project Structure

```text
├── data/
│   └── users.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── uploads/
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

## File Description

- **index.html** — Application structure and user interface
- **style.css** — Responsive styling and meeting dashboard design
- **app.js** — Authentication, WebRTC, chat, file sharing, screen sharing and whiteboard functionality
- **server.js** — Express server, authentication APIs, file uploads and Socket.IO real-time communication
- **users.json** — Stores registered user data
- **uploads/** — Stores shared files
- **package.json** — Project dependencies and start scripts
- **.gitignore** — Prevents unnecessary and sensitive files from being uploaded

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Highlights

This project combines **WebRTC for real-time media communication** and **Socket.IO for real-time events**, creating an interactive platform for communication and collaboration.

Built as a full-stack real-time communication project.
