const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const JWT_SECRET = "REAL_TIME_COMMUNICATION_SECRET_2026";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

function getUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    } catch {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            name: user.name,
            email: user.email
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Please fill all fields"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });
        }

        const users = getUsers();

        const existingUser = users.find(
            user => user.email.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now().toString(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword
        };

        users.push(newUser);
        saveUsers(users);

        const token = createToken(newUser);

        res.json({
            message: "Registration successful",
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Please enter email and password"
            });
        }

        const users = getUsers();

        const user = users.find(
            user => user.email.toLowerCase() === email.toLowerCase()
        );

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = createToken(user);

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

app.get("/api/me", authenticate, (req, res) => {
    res.json({
        user: req.user
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },

    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");

        cb(
            null,
            `${Date.now()}-${safeName}`
        );
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

app.post(
    "/api/upload",
    authenticate,
    upload.single("file"),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                message: "No file selected"
            });
        }

        res.json({
            message: "File uploaded successfully",
            file: {
                name: req.file.originalname,
                size: req.file.size,
                url: `/uploads/${req.file.filename}`
            }
        });
    }
);

const rooms = {};

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        socket.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        next(new Error("Invalid token"));
    }
});

io.on("connection", socket => {
    console.log(`${socket.user.name} connected`);

    socket.on("join-room", roomId => {
        if (!roomId) return;

        socket.join(roomId);
        socket.roomId = roomId;

        if (!rooms[roomId]) {
            rooms[roomId] = {};
        }

        const existingUsers = Object.keys(rooms[roomId]);

        rooms[roomId][socket.id] = {
            id: socket.id,
            name: socket.user.name
        };

        socket.emit("existing-users", existingUsers);

        socket.to(roomId).emit("user-joined", {
            id: socket.id,
            name: socket.user.name
        });

        console.log(`${socket.user.name} joined room ${roomId}`);
    });

    socket.on("offer", data => {
        io.to(data.target).emit("offer", {
            offer: data.offer,
            sender: socket.id,
            name: socket.user.name
        });
    });

    socket.on("answer", data => {
        io.to(data.target).emit("answer", {
            answer: data.answer,
            sender: socket.id
        });
    });

    socket.on("ice-candidate", data => {
        io.to(data.target).emit("ice-candidate", {
            candidate: data.candidate,
            sender: socket.id
        });
    });

    socket.on("chat-message", data => {
        if (!socket.roomId) return;

        io.to(socket.roomId).emit("chat-message", {
            sender: socket.user.name,
            message: data.message,
            time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            })
        });
    });

    socket.on("whiteboard-draw", data => {
        if (!socket.roomId) return;

        socket.to(socket.roomId).emit("whiteboard-draw", data);
    });

    socket.on("file-shared", data => {
        if (!socket.roomId) return;

        socket.to(socket.roomId).emit("file-shared", {
            sender: socket.user.name,
            ...data
        });
    });

    socket.on("leave-room", () => {
        leaveRoom(socket);
    });

    socket.on("disconnect", () => {
        leaveRoom(socket);

        console.log(`${socket.user.name} disconnected`);
    });
});

function leaveRoom(socket) {
    const roomId = socket.roomId;

    if (!roomId) return;

    if (rooms[roomId]) {
        delete rooms[roomId][socket.id];

        socket.to(roomId).emit("user-left", socket.id);

        if (Object.keys(rooms[roomId]).length === 0) {
            delete rooms[roomId];
        }
    }

    socket.leave(roomId);
    socket.roomId = null;
}

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
    console.log("=================================");
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("=================================");
});