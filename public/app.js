let currentUser = null;
let currentRoom = null;

let socket = null;

let localStream = null;
let screenStream = null;

let peerConnections = {};

let micEnabled = true;
let cameraEnabled = true;
let screenSharing = false;

const peerConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("token");

    if (token) {
        checkLogin();
    } else {
        showAuthPage();
    }

});


/* =========================================================
   AUTH
========================================================= */

function showAuthPage() {

    document.getElementById("authPage").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("meetingPage").classList.add("hidden");
}

function showLogin() {

    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");

    document.getElementById("loginTab").classList.add("active");
    document.getElementById("registerTab").classList.remove("active");

    clearMessages();
}

function showRegister() {

    document.getElementById("registerForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");

    document.getElementById("registerTab").classList.add("active");
    document.getElementById("loginTab").classList.remove("active");

    clearMessages();
}

function clearMessages() {

    document.getElementById("loginMessage").textContent = "";
    document.getElementById("registerMessage").textContent = "";
}


async function register() {

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    const message = document.getElementById("registerMessage");

    if (!name || !email || !password) {

        message.textContent = "Please fill all fields";
        message.style.color = "#ef4444";

        return;
    }

    try {

        const response = await fetch("/api/register", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })

        });

        const data = await response.json();

        if (!response.ok) {

            message.textContent = data.message;
            message.style.color = "#ef4444";

            return;
        }

        localStorage.setItem("token", data.token);

        currentUser = data.user;

        showDashboard();

    } catch (error) {

        message.textContent = "Server error. Please try again.";
        message.style.color = "#ef4444";
    }
}


async function login() {

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const message = document.getElementById("loginMessage");

    if (!email || !password) {

        message.textContent = "Please enter email and password";
        message.style.color = "#ef4444";

        return;
    }

    try {

        const response = await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await response.json();

        if (!response.ok) {

            message.textContent = data.message;
            message.style.color = "#ef4444";

            return;
        }

        localStorage.setItem("token", data.token);

        currentUser = data.user;

        showDashboard();

    } catch (error) {

        message.textContent = "Server error. Please try again.";
        message.style.color = "#ef4444";
    }
}


async function checkLogin() {

    const token = localStorage.getItem("token");

    if (!token) {

        showAuthPage();
        return;
    }

    try {

        const response = await fetch("/api/me", {

            headers: {
                Authorization: `Bearer ${token}`
            }

        });

        if (!response.ok) {

            localStorage.removeItem("token");
            showAuthPage();

            return;
        }

        const data = await response.json();

        currentUser = data.user;

        showDashboard();

    } catch (error) {

        localStorage.removeItem("token");

        showAuthPage();
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

function showDashboard() {

    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("meetingPage").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    if (!currentUser) return;

    document.getElementById("dashboardUserName").textContent =
        currentUser.name;

    document.getElementById("dashboardUserEmail").textContent =
        currentUser.email;

    document.getElementById("welcomeName").textContent =
        currentUser.name;

    document.getElementById("userAvatar").textContent =
        currentUser.name.charAt(0).toUpperCase();
}


function createMeeting() {

    const roomId = generateRoomId();

    document.getElementById("roomInput").value = roomId;

    enterMeeting(roomId);
}


function joinMeeting() {

    const roomId =
        document.getElementById("roomInput").value.trim();

    if (!roomId) {

        alert("Please enter a Room ID");

        return;
    }

    enterMeeting(roomId);
}


function generateRoomId() {

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let room = "";

    for (let i = 0; i < 6; i++) {
        room += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return room;
}


/* =========================================================
   ENTER MEETING
========================================================= */

async function enterMeeting(roomId) {

    const token = localStorage.getItem("token");

    if (!token || !currentUser) {

        showAuthPage();

        return;
    }

    currentRoom = roomId;

    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("meetingPage").classList.remove("hidden");

    document.getElementById("currentRoom").textContent =
        currentRoom;

    document.getElementById("messages").innerHTML = "";
    document.getElementById("fileList").innerHTML = "";
    document.getElementById("videoGrid").innerHTML = "";

    micEnabled = true;
    cameraEnabled = true;
    screenSharing = false;

    try {

        await startCamera();

        connectSocket();

    } catch (error) {

        console.error(error);

        alert(
            "Camera/microphone permission is required for the meeting."
        );

        leaveMeeting();
    }
}


/* =========================================================
   CAMERA
========================================================= */

async function startCamera() {

    if (localStream) {

        localStream.getTracks().forEach(track => {
            track.stop();
        });
    }

    localStream =
        await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

    addVideo(
        "local",
        localStream,
        `${currentUser.name} (You)`
    );
}


function addVideo(id, stream, name) {

    const existing =
        document.getElementById(`video-${id}`);

    if (existing) {

        const video =
            existing.querySelector("video");

        video.srcObject = stream;

        return;
    }

    const card =
        document.createElement("div");

    card.className = "video-card";
    card.id = `video-${id}`;

    const video =
        document.createElement("video");

    video.autoplay = true;
    video.playsInline = true;

    if (id === "local") {
        video.muted = true;
    }

    video.srcObject = stream;

    const nameTag =
        document.createElement("div");

    nameTag.className = "video-name";
    nameTag.textContent = name;

    card.appendChild(video);
    card.appendChild(nameTag);

    document
        .getElementById("videoGrid")
        .appendChild(card);
}


function removeVideo(id) {

    const element =
        document.getElementById(`video-${id}`);

    if (element) {
        element.remove();
    }
}


/* =========================================================
   SOCKET
========================================================= */

function connectSocket() {

    const token = localStorage.getItem("token");

    socket = io({
        auth: {
            token
        }
    });

    socket.on("connect", () => {

        socket.emit("join-room", currentRoom);
    });


    socket.on("connect_error", error => {

        console.error("Socket error:", error.message);

        alert("Connection error. Please login again.");

        logout();
    });


    socket.on("existing-users", users => {

        users.forEach(userId => {

            createPeerConnection(
                userId,
                true
            );
        });
    });


    socket.on("user-joined", user => {

        createPeerConnection(
            user.id,
            true
        );
    });


    socket.on("offer", async data => {

        const peer =
            createPeerConnection(
                data.sender,
                false
            );

        await peer.setRemoteDescription(
            new RTCSessionDescription(data.offer)
        );

        const answer =
            await peer.createAnswer();

        await peer.setLocalDescription(answer);

        socket.emit("answer", {

            target: data.sender,

            answer
        });
    });


    socket.on("answer", async data => {

        const peer =
            peerConnections[data.sender];

        if (!peer) return;

        await peer.setRemoteDescription(
            new RTCSessionDescription(data.answer)
        );
    });


    socket.on("ice-candidate", async data => {

        const peer =
            peerConnections[data.sender];

        if (!peer) return;

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );

        } catch (error) {

            console.error(error);
        }
    });


    socket.on("user-left", userId => {

        closePeer(userId);

        removeVideo(userId);
    });


    socket.on("chat-message", data => {

        addMessage(
            data.sender,
            data.message,
            data.time
        );
    });


    socket.on("file-shared", data => {

        addFileCard(
            data.name,
            data.url,
            data.size,
            data.sender
        );
    });


    socket.on("whiteboard-draw", data => {

        drawRemoteLine(data);
    });
}


/* =========================================================
   WEBRTC
========================================================= */

function createPeerConnection(userId, shouldCreateOffer) {

    if (peerConnections[userId]) {

        return peerConnections[userId];
    }

    const peer =
        new RTCPeerConnection(peerConfig);

    peerConnections[userId] = peer;


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peer.addTrack(
                    track,
                    localStream
                );
            });
    }


    peer.onicecandidate = event => {

        if (event.candidate && socket) {

            socket.emit("ice-candidate", {

                target: userId,

                candidate: event.candidate
            });
        }
    };


    peer.ontrack = event => {

        const stream =
            event.streams[0];

        addVideo(
            userId,
            stream,
            "Participant"
        );
    };


    peer.onconnectionstatechange = () => {

        if (
            peer.connectionState === "failed" ||
            peer.connectionState === "closed" ||
            peer.connectionState === "disconnected"
        ) {

            closePeer(userId);

            removeVideo(userId);
        }
    };


    if (shouldCreateOffer) {

        createOffer(
            peer,
            userId
        );
    }

    return peer;
}


async function createOffer(peer, userId) {

    try {

        const offer =
            await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("offer", {

            target: userId,

            offer
        });

    } catch (error) {

        console.error("Offer error:", error);
    }
}


function closePeer(userId) {

    if (peerConnections[userId]) {

        peerConnections[userId].close();

        delete peerConnections[userId];
    }
}


/* =========================================================
   MICROPHONE
========================================================= */

function toggleMic() {

    if (!localStream) return;

    micEnabled = !micEnabled;

    localStream
        .getAudioTracks()
        .forEach(track => {
            track.enabled = micEnabled;
        });

    const button =
        document.getElementById("micBtn");

    button.textContent =
        micEnabled ? "🎤" : "🔇";
}


/* =========================================================
   CAMERA
========================================================= */

function toggleCamera() {

    if (!localStream) return;

    cameraEnabled = !cameraEnabled;

    localStream
        .getVideoTracks()
        .forEach(track => {
            track.enabled = cameraEnabled;
        });

    const button =
        document.getElementById("cameraBtn");

    button.textContent =
        cameraEnabled ? "📹" : "🚫";
}


/* =========================================================
   SCREEN SHARING
========================================================= */

async function toggleScreenShare() {

    if (!localStream) return;

    if (!screenSharing) {

        try {

            screenStream =
                await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

            const screenTrack =
                screenStream.getVideoTracks()[0];

            Object.values(peerConnections)
                .forEach(peer => {

                    const sender =
                        peer.getSenders().find(
                            sender =>
                                sender.track &&
                                sender.track.kind === "video"
                        );

                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

            const localVideo =
                document.querySelector(
                    "#video-local video"
                );

            if (localVideo) {
                localVideo.srcObject =
                    screenStream;
            }

            screenSharing = true;

            document.getElementById("screenBtn")
                .textContent = "⏹️";

            screenTrack.onended = () => {

                stopScreenShare();
            };

        } catch (error) {

            console.log("Screen sharing cancelled");
        }

    } else {

        stopScreenShare();
    }
}


async function stopScreenShare() {

    if (!screenStream) return;

    const cameraTrack =
        localStream.getVideoTracks()[0];

    Object.values(peerConnections)
        .forEach(peer => {

            const sender =
                peer.getSenders().find(
                    sender =>
                        sender.track &&
                        sender.track.kind === "video"
                );

            if (sender) {
                sender.replaceTrack(cameraTrack);
            }
        });

    const localVideo =
        document.querySelector(
            "#video-local video"
        );

    if (localVideo) {

        localVideo.srcObject =
            localStream;
    }

    screenStream
        .getTracks()
        .forEach(track => track.stop());

    screenStream = null;
    screenSharing = false;

    document.getElementById("screenBtn")
        .textContent = "🖥️";
}


/* =========================================================
   CHAT
========================================================= */

function sendMessage() {

    const input =
        document.getElementById("messageInput");

    const message =
        input.value.trim();

    if (!message || !socket) return;

    socket.emit("chat-message", {
        message
    });

    input.value = "";
}


function handleMessageKey(event) {

    if (event.key === "Enter") {

        sendMessage();
    }
}


function addMessage(sender, message, time) {

    const container =
        document.getElementById("messages");

    const item =
        document.createElement("div");

    item.className = "message-item";

    const senderElement =
        document.createElement("div");

    senderElement.className =
        "message-sender";

    senderElement.textContent =
        sender;

    const messageElement =
        document.createElement("div");

    messageElement.className =
        "message-text";

    messageElement.textContent =
        message;

    const timeElement =
        document.createElement("div");

    timeElement.className =
        "message-time";

    timeElement.textContent =
        time;

    item.appendChild(senderElement);
    item.appendChild(messageElement);
    item.appendChild(timeElement);

    container.appendChild(item);

    container.scrollTop =
        container.scrollHeight;
}


/* =========================================================
   FILE SHARING
========================================================= */

async function uploadFile() {

    const input =
        document.getElementById("fileInput");

    const file =
        input.files[0];

    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {

        alert("Maximum file size is 20 MB");

        input.value = "";

        return;
    }

    const formData =
        new FormData();

    formData.append("file", file);

    try {

        const token =
            localStorage.getItem("token");

        const response =
            await fetch("/api/upload", {

                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${token}`
                },

                body: formData
            });

        const data =
            await response.json();

        if (!response.ok) {

            alert(data.message);

            return;
        }

        addFileCard(
            data.file.name,
            data.file.url,
            data.file.size,
            "You"
        );

        if (socket) {

            socket.emit("file-shared", {

                name: data.file.name,
                url: data.file.url,
                size: data.file.size
            });
        }

        input.value = "";

    } catch (error) {

        console.error(error);

        alert("File upload failed");
    }
}


function addFileCard(
    name,
    url,
    size,
    sender
) {

    const list =
        document.getElementById("fileList");

    const card =
        document.createElement("div");

    card.className = "file-card";

    const icon =
        document.createElement("div");

    icon.className =
        "file-card-icon";

    icon.textContent = "📄";

    const content =
        document.createElement("div");

    content.className =
        "file-card-content";

    const fileName =
        document.createElement("div");

    fileName.className =
        "file-card-name";

    fileName.textContent =
        name;

    const senderText =
        document.createElement("div");

    senderText.className =
        "file-card-sender";

    senderText.textContent =
        `${sender} • ${formatFileSize(size)}`;

    content.appendChild(fileName);
    content.appendChild(senderText);

    const download =
        document.createElement("a");

    download.href = url;
    download.target = "_blank";
    download.textContent = "Open";

    card.appendChild(icon);
    card.appendChild(content);
    card.appendChild(download);

    list.appendChild(card);
}


function formatFileSize(bytes) {

    if (!bytes) return "0 KB";

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


/* =========================================================
   WHITEBOARD
========================================================= */

let whiteboardCanvas;
let whiteboardContext;

let drawing = false;
let lastX = 0;
let lastY = 0;


function setupWhiteboard() {

    whiteboardCanvas =
        document.getElementById("whiteboard");

    if (!whiteboardCanvas) return;

    whiteboardContext =
        whiteboardCanvas.getContext("2d");

    resizeWhiteboard();

    window.addEventListener(
        "resize",
        resizeWhiteboard
    );

    whiteboardCanvas.addEventListener(
        "mousedown",
        startDrawing
    );

    whiteboardCanvas.addEventListener(
        "mousemove",
        draw
    );

    whiteboardCanvas.addEventListener(
        "mouseup",
        stopDrawing
    );

    whiteboardCanvas.addEventListener(
        "mouseleave",
        stopDrawing
    );
}


function resizeWhiteboard() {

    if (!whiteboardCanvas) return;

    const rect =
        whiteboardCanvas.getBoundingClientRect();

    const oldImage =
        whiteboardCanvas.width > 0
            ? whiteboardContext.getImageData(
                0,
                0,
                whiteboardCanvas.width,
                whiteboardCanvas.height
            )
            : null;

    whiteboardCanvas.width =
        rect.width;

    whiteboardCanvas.height =
        rect.height;

    whiteboardContext.lineWidth = 3;
    whiteboardContext.lineCap = "round";
    whiteboardContext.strokeStyle = "#111827";

    if (oldImage) {

        whiteboardContext.putImageData(
            oldImage,
            0,
            0
        );
    }
}


function startDrawing(event) {

    drawing = true;

    const rect =
        whiteboardCanvas.getBoundingClientRect();

    lastX =
        event.clientX - rect.left;

    lastY =
        event.clientY - rect.top;
}


function draw(event) {

    if (!drawing) return;

    const rect =
        whiteboardCanvas.getBoundingClientRect();

    const x =
        event.clientX - rect.left;

    const y =
        event.clientY - rect.top;

    drawLine(
        lastX,
        lastY,
        x,
        y
    );

    if (socket) {

        socket.emit("whiteboard-draw", {

            x1: lastX,
            y1: lastY,
            x2: x,
            y2: y
        });
    }

    lastX = x;
    lastY = y;
}


function stopDrawing() {

    drawing = false;
}


function drawLine(
    x1,
    y1,
    x2,
    y2
) {

    if (!whiteboardContext) return;

    whiteboardContext.beginPath();

    whiteboardContext.moveTo(
        x1,
        y1
    );

    whiteboardContext.lineTo(
        x2,
        y2
    );

    whiteboardContext.stroke();
}


function drawRemoteLine(data) {

    drawLine(
        data.x1,
        data.y1,
        data.x2,
        data.y2
    );
}


function toggleWhiteboard() {

    const panel =
        document.getElementById("whiteboardPanel");

    panel.classList.toggle("hidden");

    if (!panel.classList.contains("hidden")) {

        setTimeout(() => {

            if (!whiteboardCanvas) {
                setupWhiteboard();
            } else {
                resizeWhiteboard();
            }

        }, 100);
    }
}


/* =========================================================
   COPY ROOM ID
========================================================= */

function copyRoomId() {

    if (!currentRoom) return;

    navigator.clipboard.writeText(
        currentRoom
    );

    alert("Room ID copied!");
}


/* =========================================================
   LEAVE MEETING
========================================================= */

function leaveMeeting() {

    console.log("Leaving meeting...");

    /* Stop screen sharing */

    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(track => track.stop());

        screenStream = null;
    }


    /* Stop camera and microphone */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => track.stop());

        localStream = null;
    }


    /* Close all WebRTC connections */

    Object.keys(peerConnections)
        .forEach(userId => {

            try {

                peerConnections[userId].close();

            } catch (error) {

                console.log(error);
            }
        });

    peerConnections = {};


    /* Tell server that we are leaving */

    if (socket) {

        try {

            socket.emit("leave-room");

            socket.disconnect();

        } catch (error) {

            console.log(error);
        }

        socket = null;
    }


    /* Clear meeting data */

    currentRoom = null;

    screenSharing = false;
    micEnabled = true;
    cameraEnabled = true;


    /* Clear meeting UI */

    document.getElementById("videoGrid").innerHTML = "";
    document.getElementById("messages").innerHTML = "";
    document.getElementById("fileList").innerHTML = "";

    document.getElementById("whiteboardPanel")
        .classList.add("hidden");


    /* IMPORTANT:
       Return to DASHBOARD,
       NOT LOGIN PAGE.
    */

    showDashboard();
}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    if (socket) {

        try {
            socket.emit("leave-room");
            socket.disconnect();
        } catch (error) {
            console.log(error);
        }

        socket = null;
    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => track.stop());

        localStream = null;
    }


    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(track => track.stop());

        screenStream = null;
    }


    Object.keys(peerConnections)
        .forEach(userId => {

            try {
                peerConnections[userId].close();
            } catch {}
        });


    peerConnections = {};

    currentUser = null;
    currentRoom = null;

    localStorage.removeItem("token");

    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";

    showAuthPage();
    showLogin();
}