import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const endRef = useRef(null);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId),
    [chats, selectedChatId]
  );

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      loadChat(selectedChatId);
    }
  }, [selectedChatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadChats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`);
      if (!response.ok) {
        setChats([]);
        setError("Backend is not reachable. Check API server.");
        return;
      }

      const data = await response.json();
      const safeChats = Array.isArray(data) ? data : [];
      setChats(safeChats);
      setError("");

      if (!selectedChatId && safeChats.length > 0) {
        setSelectedChatId(safeChats[0].id);
      }
    } catch {
      setChats([]);
      setError("Backend is not reachable. Check API server.");
    }
  }

  async function loadChat(chatId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`);
      if (!response.ok) return;

      const data = await response.json();
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setError("");
    } catch {
      setError("Unable to load chat.");
    }
  }

  async function createChat() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });
      if (!response.ok) {
        setError("Unable to create chat.");
        return;
      }

      const chat = await response.json();
      setChats((prev) => [chat, ...prev]);
      setSelectedChatId(chat.id);
      setMessages([]);
      setError("");
    } catch {
      setError("Unable to create chat.");
    }
  }

  async function handleSend() {
    if ((!input.trim() && !imageBase64) || loading) return;

    let chatId = selectedChatId;
    if (!chatId) {
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New chat" }),
      });
      if (!response.ok) {
        setLoading(false);
        setError("Unable to create chat.");
        return;
      }
      const chat = await response.json();
      chatId = chat.id;
      setSelectedChatId(chatId);
    }

    const draftUserMessage = {
      id: Date.now(),
      chat_id: chatId,
      role: "user",
      content: input,
      image_base64: imageBase64,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, draftUserMessage]);
    const sentText = input;
    const sentImage = imageBase64;
    setInput("");
    setImageBase64(null);
    setImagePreview(null);
    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: sentText, image_base64: sentImage }),
    });

    if (response.ok) {
      const pair = await response.json();
      setMessages((prev) => [...prev.slice(0, -1), ...pair]);
      await loadChats();
      setSelectedChatId(chatId);
      setError("");
    } else {
      setMessages((prev) => prev.slice(0, -1));
      const errorText = await response.text();
      alert(`Failed to send message: ${errorText}`);
    }

    setLoading(false);
  }

  async function onImageSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const base64 = await toBase64(file);
    const cleanedBase64 = String(base64).split(",")[1];
    setImageBase64(cleanedBase64);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Chats</h2>
        <button className="new-chat-btn" onClick={createChat}>
          + New Chat
        </button>
        <div className="chat-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-item ${chat.id === selectedChatId ? "active" : ""}`}
              onClick={() => setSelectedChatId(chat.id)}
            >
              {chat.title}
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        <div className="messages">
          {error && <div className="message assistant">{error}</div>}
          {!selectedChat && messages.length === 0 && (
            <div className="message assistant">Welcome to Amna's AI</div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.content}
              {msg.image_base64 && msg.role === "user" && (
                <img
                  className="upload-preview"
                  src={`data:image/jpeg;base64,${msg.image_base64}`}
                  alt="upload"
                />
              )}
            </div>
          ))}

          {loading && <div className="message assistant">Thinking...</div>}
          <div ref={endRef} />
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
          />
          <input type="file" accept="image/*" onChange={onImageSelected} />
          <button onClick={handleSend}>Send</button>
        </div>

        {imagePreview && (
          <div style={{ padding: "0 14px 14px" }}>
            <strong>Selected image:</strong>
            <div>
              <img className="upload-preview" src={imagePreview} alt="Selected preview" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default App;
