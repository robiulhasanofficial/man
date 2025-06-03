require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://robiulhasanofficial.github.io",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const SECRET_CODE = process.env.SECRET_CODE || "CCCDS999";
const users = {};

// ✅ হেলথ চেক
app.get("/", (req, res) => {
  res.send("✅ Server is running");
});

// ✅ MongoDB সংযোগ
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("✅ Connected to MongoDB");
}).catch((err) => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

// ✅ মেসেজ স্কিমা
const messageSchema = new mongoose.Schema({
  sender: String,
  content: String,
  type: { type: String, default: "text" },
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

// ✅ Socket.io হ্যান্ডলিং
io.on("connection", async (socket) => {
  console.log("🟢 User connected:", socket.id);

  // পুরানো মেসেজ পাঠাও
  const oldMessages = await Message.find().sort({ timestamp: 1 }).limit(100);
  socket.emit("message history", oldMessages);

  // ইউজার রেজিস্ট্রেশন
  socket.on("register", ({ username, code }) => {
    if (code !== SECRET_CODE) {
      socket.emit("register_failed", "❌ Invalid code");
      return;
    }

    users[socket.id] = username;
    socket.emit("register_success", "✅ Registered successfully");
    io.emit("user list", Object.values(users));
    
    // Update active users count
    io.emit("active users", Object.keys(users).length);  // Fix here

  });

  // টেক্সট মেসেজ
  socket.on("chat message", async (msg) => {
    console.log("💬 Message:", msg);
    const newMsg = new Message({
      sender: msg.sender,
      content: msg.content,
      type: "text",
      timestamp: new Date()
    });
    await newMsg.save();
    io.emit("chat message", newMsg);
  });

  // মিডিয়া মেসেজ
  socket.on("chat media", async (media) => {
    console.log("📷 Media received:", media);
    const newMedia = new Message({
      sender: media.sender,
      content: media.content,
      type: media.type,
      timestamp: new Date()
    });
    await newMedia.save();
    io.emit("chat media", newMedia);
  });

  // ডিসকানেক্ট
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    delete users[socket.id];
    io.emit("user list", Object.values(users));

    // Update active users count after disconnect
    io.emit("active users", Object.keys(users).length);  // Fix here
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});
// ✅ ডিলিট মেসেজ
app.delete("/delete-message/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await Message.findByIdAndDelete(id);
    io.emit("message deleted", id); // ক্লায়েন্টকে জানিয়ে দাও
    res.status(200).json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});



// ✅ সার্ভার চালু
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
