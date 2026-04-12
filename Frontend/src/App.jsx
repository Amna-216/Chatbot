import React, { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "./constants.colors";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "chatbot_token";
const USER_KEY = "chatbot_user";
const PROMPT_TRANSITION_MS = 380;

function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthValidation, setShowAuthValidation] = useState(false);
  const [authFieldErrors, setAuthFieldErrors] = useState({ email: false, password: false });
  const [loginMessage, setLoginMessage] = useState("");
  const [authPasswordVisible, setAuthPasswordVisible] = useState(false);

  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [genericFilename, setGenericFilename] = useState("");
  const [genericType, setGenericType] = useState("");
  const [activePromptText, setActivePromptText] = useState("");
  const [promptTransitioning, setPromptTransitioning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState(null);
  const [showRecentDialog, setShowRecentDialog] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chatDeleteTarget, setChatDeleteTarget] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changePasswordVisibility, setChangePasswordVisibility] = useState({
    newPassword: false,
    confirmPassword: false,
  });

  const fileInputRef = useRef(null);
  const endRef = useRef(null);
  const chatSearchInputRef = useRef(null);

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId), [chats, selectedChatId]);
  const displayName = currentUser?.username || authUsername || "there";
  const showWelcome = messages.length === 0 && (!selectedChatId || selectedChat?.title === "New chat");
  const signupEmailInvalid = authMode === "signup" && !authEmail.includes("@");
  const signupPasswordInvalid = authMode === "signup" && authPassword.length < 6;
  const showSignupEmailValidation = authMode === "signup" && showAuthValidation && signupEmailInvalid;
  const showSignupPasswordValidation = authMode === "signup" && showAuthValidation && signupPasswordInvalid;
  const loginEmailFormatInvalid =
    authMode === "login" &&
    showAuthValidation &&
    authIdentifier.trim().includes(".") &&
    !authIdentifier.includes("@");
  const showLoginPasswordValidation =
    authMode === "login" &&
    showAuthValidation &&
    authPassword.length > 0 &&
    authPassword.length < 6;

  useEffect(() => {
    if (token) {
      loadCurrentUser();
      loadChats();
    }
  }, [token]);

  useEffect(() => {
    if (selectedChatId && token) {
      loadChat(selectedChatId);
    }
  }, [selectedChatId, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (showRecentDialog) {
      window.setTimeout(() => chatSearchInputRef.current?.focus(), 0);
    }
  }, [showRecentDialog]);

  const filteredChats = useMemo(() => {
    const query = chatSearchQuery.trim().toLowerCase();
    if (!query) return chats;
    return chats.filter((chat) => chat.title.toLowerCase().includes(query));
  }, [chats, chatSearchQuery]);

  const groupedChats = useMemo(() => groupChatsByDate(filteredChats), [filteredChats]);

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function loadCurrentUser() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, { headers: authHeaders() });
      if (!response.ok) {
        handleLogout();
        return;
      }
      const user = await response.json();
      setCurrentUser(user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      setError("Unable to load user profile.");
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setShowAuthValidation(true);
    setAuthFieldErrors({ email: false, password: false });
    setLoginMessage("");

    if (authMode === "signup" && signupEmailInvalid) {
      setError("");
      return;
    }
    if (authMode === "signup" && signupPasswordInvalid) {
      setError("");
      return;
    }

    if (authMode === "login") {
      const identifierMissing = !authIdentifier.trim();
      const emailFormatInvalid = authIdentifier.trim().includes(".") && !authIdentifier.includes("@");
      const passwordTooShort = authPassword.length < 6;

      if (identifierMissing || emailFormatInvalid || passwordTooShort) {
        setAuthFieldErrors({
          email: identifierMissing || emailFormatInvalid,
          password: passwordTooShort,
        });
        setLoginMessage("");
        setError("");
        return;
      }
    }

    if (authMode === "signup" && !authUsername.trim()) {
      setError("Username is required.");
      return;
    }

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    const payload =
      authMode === "signup"
        ? { username: authUsername, email: authEmail, password: authPassword }
        : { identifier: authIdentifier, password: authPassword };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const fieldErrors = getAuthFieldErrors(data?.detail, response.status);
        if (authMode === "login" && (fieldErrors.email || fieldErrors.password)) {
          setAuthFieldErrors(fieldErrors);
          setLoginMessage(getLoginMessage(fieldErrors));
          setError("");
          return;
        }
        setError(typeof data?.detail === "string" ? data.detail : "Authentication failed.");
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      setToken(data.access_token);
      setCurrentUser(data.user);
      setAuthUsername("");
      setAuthIdentifier("");
      setAuthEmail("");
      setAuthPassword("");
      setShowAuthValidation(false);
      setAuthFieldErrors({ email: false, password: false });
      setLoginMessage("");
      setAuthPasswordVisible(false);
      setChats([]);
      setMessages([]);
      setSelectedChatId(null);
    } catch {
      setError("Authentication service unavailable.");
    }
  }

  function getAuthFieldErrors(detail, statusCode) {
    if (detail && typeof detail === "object") {
      return {
        email: detail.field === "identifier",
        password: detail.field === "password",
      };
    }

    if (typeof detail === "string") {
      const normalized = detail.toLowerCase();

      if (normalized.includes("incorrect password")) {
        return { email: false, password: true };
      }

      if (
        normalized.includes("invalid email or username") ||
        normalized.includes("invalid username/email") ||
        normalized.includes("invalid username or email")
      ) {
        return { email: true, password: false };
      }

      if (normalized.includes("password") && !normalized.includes("username") && !normalized.includes("email")) {
        return { email: false, password: true };
      }

      if ((normalized.includes("username") || normalized.includes("email")) && !normalized.includes("password")) {
        return { email: true, password: false };
      }
    }

    if (authMode === "login" && statusCode === 401) {
      return { email: true, password: false };
    }

    return { email: false, password: false };
  }

  function getLoginMessage(fieldErrors) {
    if (fieldErrors.email && fieldErrors.password) return "Invalid email and password";
    if (fieldErrors.email) return "Invalid email or username";
    if (fieldErrors.password) return "Invalid password";
    return "";
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setCurrentUser(null);
    setChats([]);
    setMessages([]);
    setSelectedChatId(null);
    setError("");
    setProfileOpen(false);
    setSettingsMessage("");
    setShowSettingsDialog(false);
    setShowChangePasswordDialog(false);
    setShowDeleteDialog(false);
    setShowRecentDialog(false);
    setChatDeleteTarget(null);
  }

  function resetAuthState(nextMode) {
    setAuthMode(nextMode);
    setError("");
    setShowAuthValidation(false);
    setAuthFieldErrors({ email: false, password: false });
    setLoginMessage("");
    setAuthUsername("");
    setAuthIdentifier("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthPasswordVisible(false);
  }

  async function loadChats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`, { headers: authHeaders() });
      if (!response.ok) {
        setChats([]);
        setError("Unable to fetch chats.");
        return;
      }
      const data = await response.json();
      const safeChats = Array.isArray(data) ? data : [];
      setChats(safeChats);
      setError("");
    } catch {
      setChats([]);
      setError("Unable to fetch chats.");
    }
  }

  async function loadChat(chatId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, { headers: authHeaders() });
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
        headers: authHeaders(),
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
      return chat;
    } catch {
      setError("Unable to create chat.");
      return null;
    }
  }

  async function deleteChat(chatId) {
    try {
      let response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (response.status === 405) {
        response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/delete`, {
          method: "POST",
          headers: authHeaders(),
        });
      }
      if (!response.ok) {
        setError("Unable to delete chat.");
        return;
      }

      const remaining = chats.filter((chat) => chat.id !== chatId);
      setChats(remaining);

      if (selectedChatId === chatId) {
        setSelectedChatId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
      }
    } catch {
      setError("Unable to delete chat.");
    }
  }

  function requestChatDelete(chat) {
    setChatDeleteTarget(chat);
  }

  async function confirmChatDelete() {
    if (!chatDeleteTarget) return;
    const chatId = chatDeleteTarget.id;
    setChatDeleteTarget(null);
    await deleteChat(chatId);
  }

  async function handleSend(overrideContent = null, options = {}) {
    const contentToSend = typeof overrideContent === "string" ? overrideContent : input;
    const trimmedContent = contentToSend.trim();

    if ((!trimmedContent && !imageBase64 && !pdfBase64) || loading) return;
    setLoading(true);

    try {
      let chatId = options.chatId ?? selectedChatId;
      if (!chatId) {
        const chat = await createChat();
        if (!chat) {
          setError("Unable to create chat.");
          setLoading(false);
          return;
        }
        chatId = chat.id;
      }

      const draft = {
        id: Date.now(),
        chat_id: chatId,
        role: "user",
        content: trimmedContent || "[Attachment message]",
        image_base64: imageBase64,
        pdf_filename: pdfFilename || null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, draft]);
      const sentText = contentToSend;
      const sentImage = imageBase64;
      const sentPdf = pdfBase64;
      const sentPdfFilename = pdfFilename;

      setInput("");
      setImageBase64(null);
      setImagePreview(null);
      setPdfBase64(null);
      setPdfFilename("");
      setGenericFilename("");
      setGenericType("");

      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: sentText, image_base64: sentImage, pdf_base64: sentPdf, pdf_filename: sentPdfFilename }),
      });

      if (response.ok) {
        const pair = await response.json();
        setMessages((prev) => [...prev.slice(0, -1), ...pair]);
        await loadChats();
      } else {
        setMessages((prev) => prev.slice(0, -1));
        const errorText = await response.text();
        alert(`Failed to send message: ${errorText}`);
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setError("Unable to send message.");
    }

    setLoading(false);
  }

  async function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    const cleaned = String(base64).split(",")[1];

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPdfBase64(cleaned);
      setPdfFilename(file.name);
      setImageBase64(null);
      setImagePreview(null);
      setGenericFilename("");
      setGenericType("");
      return;
    }

    if (file.type.startsWith("image/")) {
      setImagePreview(URL.createObjectURL(file));
      setImageBase64(cleaned);
      setPdfBase64(null);
      setPdfFilename("");
      setGenericFilename("");
      setGenericType("");
      return;
    }

    const inferredType = file.type.startsWith("video/") ? "video" : "document";
    setGenericFilename(file.name);
    setGenericType(inferredType);
    setImageBase64(null);
    setImagePreview(null);
    setPdfBase64(null);
    setPdfFilename("");
    if (!input.trim()) {
      setInput(`Please help me with this ${inferredType} file: ${file.name}`);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  async function handleComposerFocus() {
    if (!selectedChatId && !loading) {
      await createChat();
    }
  }

  async function handlePromptCardClick(promptText) {
    if (loading || promptTransitioning) return;
    setError("");
    setActivePromptText(promptText);
    setPromptTransitioning(true);

    try {
      let chatId = selectedChatId;
      if (!chatId) {
        const chat = await createChat();
        if (!chat) {
          setPromptTransitioning(false);
          setActivePromptText("");
          return;
        }
        chatId = chat.id;
      }

      await new Promise((resolve) => window.setTimeout(resolve, PROMPT_TRANSITION_MS));
      await handleSend(promptText, { chatId });
    } finally {
      setPromptTransitioning(false);
      setActivePromptText("");
    }
  }

  async function handleDeleteAccount() {
    if (settingsBusy) return;
    setSettingsBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) {
        setSettingsMessage("Unable to delete account.");
        setShowDeleteDialog(false);
        return;
      }
      handleLogout();
    } catch {
      setSettingsMessage("Unable to delete account.");
      setShowDeleteDialog(false);
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleChangePasswordSubmit(event) {
    event.preventDefault();
    if (settingsBusy) return;
    setSettingsMessage("");

    if (!changePasswordForm.email.trim()) {
      setSettingsMessage("Please enter your email for verification.");
      return;
    }

    if (changePasswordForm.newPassword.length <= 6) {
      setSettingsMessage("New password must be more than 6 characters.");
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setSettingsMessage("New password and retype password must match.");
      return;
    }

    setSettingsBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          email: changePasswordForm.email,
          new_password: changePasswordForm.newPassword,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setSettingsMessage(typeof data?.detail === "string" ? data.detail : "Unable to change password.");
        return;
      }
      setChangePasswordForm({ email: "", newPassword: "", confirmPassword: "" });
      setChangePasswordVisibility({ newPassword: false, confirmPassword: false });
      setShowChangePasswordDialog(false);
      setShowSettingsDialog(false);
      setSettingsMessage("Password changed successfully.");
    } catch {
      setSettingsMessage("Unable to change password.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleNewChatClick() {
    setShowRecentDialog(false);
    setActiveSidebarPanel("recent");
    setError("");
    await createChat();
  }

  function openRecentSidebar() {
    setShowRecentDialog(false);
    setActiveSidebarPanel("recent");
    setSidebarCollapsed(false);
  }

  function openRecentBrowser() {
    setActiveSidebarPanel(null);
    setChatSearchQuery("");
    setShowRecentDialog(true);
  }

  const themeVars = {
    "--primary": COLORS.primary,
    "--beige": COLORS.secondary,
    "--beige-soft": COLORS.surface,
    "--surface": COLORS.surface,
    "--accent": COLORS.accent,
    "--accent-hover": COLORS.accentSoft || COLORS.accent,
    "--text": COLORS.text,
    "--muted": COLORS.muted,
    "--card": COLORS.card,
    "--border": COLORS.border,
    "--white": COLORS.white,
  };

  if (!token) {
    return (
      <div className="auth-shell" style={themeVars}>
        <form className="auth-panel" onSubmit={handleAuthSubmit} noValidate>
          <div className="auth-brand">Amna's AI</div>
          <h1>{authMode === "signup" ? "Create Your Account" : "Welcome Back"}</h1>
          <p>{authMode === "signup" ? "Start private AI conversations." : "Login to continue your conversations."}</p>

          {authMode === "signup" && (
            <input
              className="auth-input"
              type="text"
              required
              placeholder="Username"
              value={authUsername}
              onChange={(e) => {
                setAuthUsername(e.target.value);
                setError("");
              }}
            />
          )}

          {authMode === "signup" ? (
            <div className={`auth-field ${showSignupEmailValidation ? "has-tooltip" : ""}`}>
              <input
                className={`auth-input ${showSignupEmailValidation ? "input-invalid" : ""}`}
                type="email"
                required
                placeholder="Email"
                value={authEmail}
                onChange={(e) => {
                  setAuthEmail(e.target.value);
                  setError("");
                }}
              />
              {showSignupEmailValidation && (
                <div className="field-tooltip" role="alert">
                  <div className="field-tooltip-title">
                    <span className="field-tooltip-icon">!</span>
                    <span>Invalid email format</span>
                  </div>
                  <div className="field-tooltip-text">
                    Please include "@" and a domain.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`auth-field ${loginEmailFormatInvalid ? "has-tooltip" : ""}`}>
              <input
                className={`auth-input ${loginEmailFormatInvalid || authFieldErrors.email ? "input-invalid" : ""}`}
                type="text"
                required
                placeholder="Email or Username"
                value={authIdentifier}
                onChange={(e) => {
                  setAuthIdentifier(e.target.value);
                  setError("");
                  setLoginMessage("");
                  setAuthFieldErrors((prev) => ({ ...prev, email: false }));
                }}
              />
              {loginEmailFormatInvalid && (
                <div className="field-tooltip" role="alert">
                  <div className="field-tooltip-title">
                    <span className="field-tooltip-icon">!</span>
                    <span>Invalid email format</span>
                  </div>
                  <div className="field-tooltip-text">
                    Please include "@" and a domain.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={`auth-field ${showSignupPasswordValidation || showLoginPasswordValidation ? "has-tooltip" : ""}`}>
            <div className="password-field">
              <input
                className={`auth-input ${showSignupPasswordValidation || showLoginPasswordValidation || authFieldErrors.password ? "input-invalid" : ""}`}
                type={authPasswordVisible ? "text" : "password"}
                required
                minLength={6}
                placeholder="Password"
                value={authPassword}
                onChange={(e) => {
                  setAuthPassword(e.target.value);
                  setError("");
                  setLoginMessage("");
                  setAuthFieldErrors((prev) => ({ ...prev, password: false }));
                }}
              />
              {authPassword.length > 0 && (
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={authPasswordVisible ? "Password visible" : "Password hidden"}
                  onClick={() => setAuthPasswordVisible((prev) => !prev)}
                >
                  {authPasswordVisible ? <IconEye /> : <IconEyeOff />}
                </button>
              )}
            </div>
            {(showSignupPasswordValidation || showLoginPasswordValidation) && (
              <div className="field-tooltip" role="alert">
                <div className="field-tooltip-title">
                  <span className="field-tooltip-icon">!</span>
                  <span>Invalid password</span>
                </div>
                <div className="field-tooltip-text">
                  Password must be at least 6 characters.
                </div>
              </div>
            )}
          </div>

          {authMode === "login" && loginMessage && <div className="auth-message">{loginMessage}</div>}
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit">{authMode === "signup" ? "Sign Up" : "Login"}</button>
          <button
            type="button"
            className="auth-switch"
            onClick={() => resetAuthState(authMode === "signup" ? "login" : "signup")}
          >
            {authMode === "signup" ? "Already have an account? Login" : "No account? Sign up"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} style={themeVars}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="logo-area">
          <div className="logo-dot">AA</div>
          {!sidebarCollapsed && (
          <div>
            <div className="brand">Amna's AI</div>
            <div className="brand-sub">your ethereal concierge</div>
          </div>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconSidebarToggle collapsed={sidebarCollapsed} />
          </button>
        </div>

        <button className="new-chat" onClick={handleNewChatClick}>
          <IconPlus />
          {!sidebarCollapsed && <span>New Chat</span>}
        </button>
        <nav className="menu">
          <button
            className={`menu-item ${activeSidebarPanel === "recent" ? "active" : ""}`}
            onClick={openRecentSidebar}
            title="Recent Conversations"
          >
            <IconClock />
            {!sidebarCollapsed && <span>Recent Conversations</span>}
          </button>
          <button
            className={`menu-item ${showRecentDialog ? "active" : ""}`}
            onClick={openRecentBrowser}
            title="Search Chats"
          >
            <IconSearch />
            {!sidebarCollapsed && <span>Search Chats</span>}
          </button>
        </nav>

        {!sidebarCollapsed && activeSidebarPanel === "recent" && (
          <div className="chat-history">
            {chats.length === 0 && <div className="sidebar-empty">No conversations yet.</div>}
            {chats.map((chat) => (
              <div key={chat.id} className={`history-row ${chat.id === selectedChatId ? "active" : ""}`}>
                <button
                  className={`history-item ${chat.id === selectedChatId ? "active" : ""}`}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                  }}
                >
                  {chat.title}
                </button>
                <button
                  className="chat-delete-btn"
                  onClick={() => requestChatDelete(chat)}
                  title="Delete chat"
                  aria-label={`Delete ${chat.title}`}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>

      <main className="main">
        {showRecentDialog && (
          <div className="dialog-backdrop" onClick={() => setShowRecentDialog(false)}>
            <div className="chat-browser-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="chat-browser-head">
                <input
                  ref={chatSearchInputRef}
                  className="chat-browser-search"
                  type="text"
                  placeholder="Search chats..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
                <button type="button" className="dialog-close" onClick={() => setShowRecentDialog(false)} aria-label="Close">
                  <IconClose />
                </button>
              </div>
              <div className="chat-browser-body">
                <button
                  type="button"
                  className="chat-browser-action"
                  onClick={async () => {
                    setShowRecentDialog(false);
                    await handleNewChatClick();
                  }}
                >
                  <IconCompose />
                  <span>New chat</span>
                </button>
                {groupedChats.length === 0 && (
                  <div className="chat-browser-empty">No matching chats found.</div>
                )}
                {groupedChats.map((group) => (
                  <div key={group.label} className="chat-browser-group">
                    <div className="chat-browser-label">{group.label}</div>
                    {group.items.map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        className="chat-browser-item"
                        onClick={() => {
                          setSelectedChatId(chat.id);
                          setShowRecentDialog(false);
                        }}
                      >
                        <IconMessageCircle />
                        <span>{chat.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showSettingsDialog && (
          <div className="dialog-backdrop" onClick={() => setShowSettingsDialog(false)}>
            <div className="settings-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="settings-dialog-head">
                <div>
                  <div className="settings-dialog-title">Settings</div>
                  <div className="settings-dialog-subtitle">Manage your account preferences and safety controls.</div>
                </div>
                <button type="button" className="dialog-close" onClick={() => setShowSettingsDialog(false)} aria-label="Close">
                  <IconClose />
                </button>
              </div>
              <div className="settings-dialog-options">
                <button
                  type="button"
                  className="settings-option"
                  onClick={() => {
                    setSettingsMessage("");
                    setShowSettingsDialog(false);
                    setShowChangePasswordDialog(true);
                  }}
                >
                  <IconLock />
                  Change password
                </button>
                <button
                  type="button"
                  className="settings-option danger"
                  onClick={() => {
                    setShowSettingsDialog(false);
                    setShowDeleteDialog(true);
                  }}
                >
                  <IconTrash />
                  Delete account
                </button>
              </div>
              {settingsMessage && <div className="settings-message modal">{settingsMessage}</div>}
            </div>
          </div>
        )}

        {showChangePasswordDialog && (
          <div className="dialog-backdrop" onClick={() => setShowChangePasswordDialog(false)}>
            <div className="settings-dialog password-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="settings-dialog-head">
                <div>
                  <div className="settings-dialog-title">Change Password</div>
                  <div className="settings-dialog-subtitle">Verify your email, then choose a new password for your account.</div>
                </div>
                <button type="button" className="dialog-close" onClick={() => setShowChangePasswordDialog(false)} aria-label="Close">
                  <IconClose />
                </button>
              </div>
              <form className="password-dialog-form" onSubmit={handleChangePasswordSubmit}>
                <input
                  className="settings-field"
                  type="email"
                  placeholder="Verify your email"
                  value={changePasswordForm.email}
                  onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <div className="settings-password-field">
                  <input
                    className="settings-field"
                    type={changePasswordVisibility.newPassword ? "text" : "password"}
                    placeholder="New password"
                    value={changePasswordForm.newPassword}
                    onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                  {changePasswordForm.newPassword.length > 0 && (
                    <button
                      type="button"
                      className="settings-password-toggle"
                      aria-label={changePasswordVisibility.newPassword ? "Password visible" : "Password hidden"}
                      onClick={() =>
                        setChangePasswordVisibility((prev) => ({ ...prev, newPassword: !prev.newPassword }))
                      }
                    >
                      {changePasswordVisibility.newPassword ? <IconEye /> : <IconEyeOff />}
                    </button>
                  )}
                </div>
                <div className="settings-password-field">
                  <input
                    className="settings-field"
                    type={changePasswordVisibility.confirmPassword ? "text" : "password"}
                    placeholder="Retype new password"
                    value={changePasswordForm.confirmPassword}
                    onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                  {changePasswordForm.confirmPassword.length > 0 && (
                    <button
                      type="button"
                      className="settings-password-toggle"
                      aria-label={changePasswordVisibility.confirmPassword ? "Password visible" : "Password hidden"}
                      onClick={() =>
                        setChangePasswordVisibility((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))
                      }
                    >
                      {changePasswordVisibility.confirmPassword ? <IconEye /> : <IconEyeOff />}
                    </button>
                  )}
                </div>
                {settingsMessage && <div className="settings-message modal">{settingsMessage}</div>}
                <div className="password-dialog-actions">
                  <button
                    type="button"
                    className="dialog-secondary"
                    onClick={() => {
                      setShowChangePasswordDialog(false);
                      setChangePasswordVisibility({ newPassword: false, confirmPassword: false });
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="dialog-primary" disabled={settingsBusy}>
                    Change password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteDialog && (
          <div className="dialog-backdrop" onClick={() => setShowDeleteDialog(false)}>
            <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="confirm-dialog-title">Delete account?</div>
              <p className="confirm-dialog-text">
                This will permanently remove your account and all of your conversations.
              </p>
              <div className="confirm-dialog-actions">
                <button type="button" className="dialog-secondary" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </button>
                <button type="button" className="dialog-danger" onClick={handleDeleteAccount} disabled={settingsBusy}>
                  Delete account
                </button>
              </div>
            </div>
          </div>
        )}
        {chatDeleteTarget && (
          <div className="dialog-backdrop" onClick={() => setChatDeleteTarget(null)}>
            <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="confirm-dialog-title">Delete chat?</div>
              <p className="confirm-dialog-text">
                This will permanently remove
                {" "}
                <strong>{chatDeleteTarget.title}</strong>
                .
              </p>
              <div className="confirm-dialog-actions">
                <button type="button" className="dialog-secondary" onClick={() => setChatDeleteTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="dialog-danger" onClick={confirmChatDelete}>
                  Delete chat
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="topbar">
          <div />
          <div className="top-actions">
            <button className="avatar-btn" onClick={() => setProfileOpen((v) => !v)}><IconUser /></button>
          </div>
        </header>

        {profileOpen && (
          <div className="profile-menu">
            <div className="profile-menu-head">
              <div className="profile-mini-avatar">{(currentUser?.username || "A").slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="profile-mini-name">{currentUser?.username}</div>
                <div className="profile-mini-sub">{currentUser?.email}</div>
              </div>
            </div>
            <button
              className="profile-menu-item"
              onClick={() => {
                setProfileOpen(false);
                setSettingsMessage("");
                setShowSettingsDialog(true);
              }}
            >
              <IconGear /> Settings
            </button>
            <button className="profile-menu-item logout" onClick={handleLogout}>Log out</button>
          </div>
        )}

        {(showWelcome || messages.length === 0) && (
          <div className={`welcome-shell ${promptTransitioning ? "prompt-transitioning" : ""}`}>
            {showWelcome && (
              <section className="hero">
                <h1>How can I help you today, {displayName}?</h1>
                <p>Your digital partner for creativity, logic, and exploration.</p>
              </section>
            )}

            {messages.length === 0 && (
              <section className="cards">
                <Card
                  icon={<IconSpark />}
                  title="Creative Writing"
                  text="Write a poetic intro for your portfolio in an elegant tone."
                  onClick={handlePromptCardClick}
                  selected={activePromptText === "Write a poetic intro for your portfolio in an elegant tone."}
                  dimmed={promptTransitioning && activePromptText !== "Write a poetic intro for your portfolio in an elegant tone."}
                  disabled={loading || promptTransitioning}
                />
                <Card
                  icon={<IconFlask />}
                  title="Deep Learning"
                  text="Explain transformers in simple words for a beginner."
                  onClick={handlePromptCardClick}
                  selected={activePromptText === "Explain transformers in simple words for a beginner."}
                  dimmed={promptTransitioning && activePromptText !== "Explain transformers in simple words for a beginner."}
                  disabled={loading || promptTransitioning}
                />
                <Card
                  icon={<IconCompass />}
                  title="Plan a Journey"
                  text="Build a calm 3-day getaway with food and local spots."
                  onClick={handlePromptCardClick}
                  selected={activePromptText === "Build a calm 3-day getaway with food and local spots."}
                  dimmed={promptTransitioning && activePromptText !== "Build a calm 3-day getaway with food and local spots."}
                  disabled={loading || promptTransitioning}
                />
              </section>
            )}
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        {messages.length > 0 && (
          <section className="thread">
            {messages.map((msg) => (
              <div key={msg.id} className={`bubble ${msg.role}`}>
                {msg.role === "assistant" ? renderFormattedMessage(msg.content) : <div>{msg.content}</div>}
                {msg.pdf_filename && <small>PDF: {msg.pdf_filename}</small>}
              </div>
            ))}
            {loading && (
              <div className="bubble assistant typing-bubble" aria-label="Assistant is typing">
                <div className="typing-indicator" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </section>
        )}

        <section className="composer-wrap">
          <div className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleComposerFocus}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask Amna's AI anything..."
              rows={1}
            />
            <input ref={fileInputRef} className="hidden-file" type="file" accept="image/*,application/pdf" onChange={onFileSelected} />
            <button className="plain-icon" onClick={() => fileInputRef.current?.click()}><IconClip /></button>
            <button className="send-btn" onClick={handleSend}><IconSend /></button>
          </div>
          {(imagePreview || pdfFilename || genericFilename) && (
            <div className="attachment-note">
              Attached: {pdfFilename || genericFilename || "Image"}{genericType ? ` (${genericType})` : ""}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function renderFormattedMessage(content) {
  const chunks = content.split(/```([\s\S]*?)```/g);

  return (
    <div className="formatted-message">
      {chunks.map((chunk, idx) => {
        if (idx % 2 === 1) {
          return (
            <CodeBlock key={idx} code={chunk.trim()} />
          );
        }

        return chunk
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .map((line, lineIdx) => {
            const trimmed = line.trim();

            if (/^#{1,6}\s+/.test(trimmed)) {
              return (
                <div key={`${idx}-${lineIdx}`} className="msg-heading">
                  <strong>{trimmed.replace(/^#{1,6}\s+/, "")}</strong>
                </div>
              );
            }

            return (
              <p key={`${idx}-${lineIdx}`} className="msg-paragraph">
                {renderInlineFormatting(line)}
              </p>
            );
          });
      })}
    </div>
  );
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block-wrap">
      <button
        type="button"
        className="code-copy-btn"
        onClick={handleCopy}
        aria-label={copied ? "Code copied" : "Copy code"}
      >
        <IconCopy />
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineFormatting(text) {
  const parts = text.split(/(\*[^*]+\*)/g);

  return parts.map((part, idx) => {
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function Card({ icon, title, text, onClick, selected = false, dimmed = false, disabled = false }) {
  return (
    <button
      type="button"
      className={`card prompt-card ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}
      onClick={() => onClick(text)}
      disabled={disabled}
    >
      <div className="card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </button>
  );
}

function groupChatsByDate(chats) {
  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  chats.forEach((chat) => {
    const updatedAt = new Date(chat.updated_at);
    if (updatedAt >= todayStart) {
      groups[0].items.push(chat);
    } else if (updatedAt >= yesterdayStart) {
      groups[1].items.push(chat);
    } else if (updatedAt >= weekStart) {
      groups[2].items.push(chat);
    } else {
      groups[3].items.push(chat);
    }
  });

  return groups.filter((group) => group.items.length > 0);
}

function Svg({ children }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
function IconPlus() { return <Svg><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg>; }
function IconClock() { return <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></Svg>; }
function IconSearch() { return <Svg><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></Svg>; }
function IconGear() { return <Svg><path d="M10.3 3.5h3.4l.5 2.1a6.9 6.9 0 0 1 1.5.9l2-.8 1.7 2.9-1.5 1.5c.1.5.1 1 .1 1.4s0 1-.1 1.4l1.5 1.5-1.7 2.9-2-.8a6.9 6.9 0 0 1-1.5.9l-.5 2.1h-3.4l-.5-2.1a6.9 6.9 0 0 1-1.5-.9l-2 .8-1.7-2.9 1.5-1.5a8.2 8.2 0 0 1 0-2.8L3.6 8.6l1.7-2.9 2 .8a6.9 6.9 0 0 1 1.5-.9z" /><circle cx="12" cy="12" r="2.6" /></Svg>; }
function IconHelp() { return <Svg><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.8.6-1.7 1.2-1.7 2.2" /><path d="M12 17h.01" /></Svg>; }
function IconDots() { return <Svg><path d="M12 5h.01M12 12h.01M12 19h.01" /></Svg>; }
function IconUser() { return <Svg><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></Svg>; }
function IconSidebarToggle({ collapsed }) { return <Svg>{collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}</Svg>; }
function IconLock() { return <Svg><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></Svg>; }
function IconCompose() { return <Svg><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13 7l4 4" /></Svg>; }
function IconMessageCircle() { return <Svg><path d="M20 11.5a8.5 8.5 0 1 1-4.1-7.3A8.2 8.2 0 0 1 20 11.5z" /><path d="M8 18l-2.5 3 .6-3.6" /></Svg>; }
function IconClose() { return <Svg><path d="M6 6l12 12M18 6L6 18" /></Svg>; }
function IconSpark() { return <Svg><path d="M12 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" /></Svg>; }
function IconFlask() { return <Svg><path d="M10 3h4" /><path d="M10 3v5l-4 8a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-8V3" /></Svg>; }
function IconCompass() { return <Svg><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 5-4 2 2-5z" /></Svg>; }
function IconClip() { return <Svg><path d="M21 10l-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 1 1 5 5l-8.5 8.5a2 2 0 1 1-3-3L15 6" /></Svg>; }
function IconMic() { return <Svg><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></Svg>; }
function IconSend() { return <Svg><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></Svg>; }
function IconTrash() { return <Svg><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></Svg>; }
function IconCopy() { return <Svg><rect x="9" y="9" width="10" height="10" rx="2" /><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></Svg>; }
function IconEye() { return <Svg><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" /></Svg>; }
function IconEyeOff() { return <Svg><path d="M3 3l18 18" /><path d="M10.6 10.7a3 3 0 0 0 4.2 4.2" /><path d="M9.9 5.1A11.4 11.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-4.1 4.9" /><path d="M6.2 6.3C3.7 8 2 12 2 12a17.8 17.8 0 0 0 10 7 11.6 11.6 0 0 0 4-.7" /></Svg>; }

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default App;
