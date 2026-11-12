import {playMessageSound} from "../../../utils/messageSound.js";
import ChatBroadcastDialog from "./ChatBroadcastDialog.jsx";
import { T, useLanguage } from "../../../i18n.jsx";
import { isTrainingUnit, trainingContactLabel } from "../../../data/unitTypes.js";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  createAdminChatMessage,
  createOutpostBroadcastMessage,
  deleteAdminChatConversation,
  deleteAdminChatMessage,
  getAdminChatMessages,
  getChatPartners,
} from "../../../api/dashboard.js";

const FILE_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.zip,.rar";
const OUTPOST_BROADCAST_ID = "all-outposts";
const EMOJI_GROUPS = [
  {
    id: "faces",
    icon: "😀",
    label: "Смайлики",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "🤪", "🤗", "🤭", "🫢", "🤔", "🫡", "🤐", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🥴", "🤢", "🤧", "🥵", "🥶", "😎", "🤓", "🧐", "😕", "😟", "🙁", "😮‍💨", "😢", "😭", "😤", "😡", "🤬", "😱", "😨", "😰", "🤯", "🥳", "🤩"],
  },
  {
    id: "gestures",
    icon: "👍",
    label: "Жесты",
    emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "🦾", "🫵", "👀", "👁️", "👄"],
  },
  {
    id: "hearts",
    icon: "❤️",
    label: "Символы",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "❣️", "💋", "💯", "💢", "💥", "💫", "💦", "💨", "🕊️", "✅", "❌", "❗", "❓", "⚠️", "♻️", "✨", "⭐", "🌟", "🔥", "🎉", "🎊"],
  },
  {
    id: "nature",
    icon: "🌿",
    label: "Природа",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦅", "🦉", "🐺", "🐗", "🐴", "🦋", "🐝", "🐞", "🐢", "🐍", "🦎", "🐙", "🐬", "🐳", "🌸", "🌹", "🌺", "🌻", "🌼", "🌷", "🌱", "🌿", "🍀", "🌲", "🌳", "🌞", "🌙", "🌈", "☀️", "☁️", "❄️"],
  },
  {
    id: "food",
    icon: "🍎",
    label: "Еда",
    emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥝", "🍅", "🥑", "🥦", "🥕", "🌽", "🥐", "🍞", "🧀", "🥚", "🍳", "🥞", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🍜", "🍝", "🍣", "🍚", "🍰", "🎂", "🍫", "🍿", "☕", "🍵", "🧃", "🥤"],
  },
  {
    id: "activity",
    icon: "⚽",
    label: "Дела",
    emojis: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🥏", "🎱", "🏓", "🏸", "🥅", "⛳", "🏹", "🎣", "🥊", "🥋", "🎽", "🛹", "🛷", "⛸️", "🎿", "🏆", "🥇", "🥈", "🥉", "🎖️", "🎯", "🎮", "🎲", "🎸", "🎹", "🥁", "🎤", "🎧", "🎬", "🎨", "📚", "✏️", "💼"],
  },
  {
    id: "travel",
    icon: "🚗",
    label: "Транспорт",
    emojis: ["🚗", "🚕", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚜", "🏍️", "🚲", "🛴", "🚨", "🚥", "🚧", "⚓", "⛵", "🚤", "🚢", "✈️", "🚁", "🚀", "🛰️", "🏠", "🏢", "🏥", "🏫", "🏰", "🗼", "🗽", "⛰️", "🏕️", "🏖️", "🌍", "🗺️", "🧭"],
  },
];

const getAttachmentKind = (file) => {
  if (!file) {
    return "";
  }

  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || name.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/)) {
    return "image";
  }
  if (file.type.startsWith("audio/") || name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) {
    return "audio";
  }
  if (file.type.startsWith("video/") || name.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/)) {
    return "video";
  }
  return "file";
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ky-KG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDisplayName = (item) => item?.full_name || item?.email || `Колдонуучу #${item?.id || ""}`;

const getInitials = (item) =>
  getDisplayName(item)
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "А";

const getAvatarSource = (item) => item?.photo_face || item?.avatar || "";

const Icon = ({ children, size = 18 }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    {children}
  </svg>
);

const ChatIcon = () => (
  <Icon size={20}>
    <path d="M7 18.5 3.5 21l1-4A8 8 0 1 1 7 18.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M8 10h8M8 14h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </Icon>
);

const UsersIcon = () => (
  <Icon>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 0 0 0-6M18 14.5a4 4 0 0 1 3 3.9V20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </Icon>
);

const SmileIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
  </Icon>
);

const MicIcon = () => (
  <Icon>
    <rect height="11" rx="3" stroke="currentColor" strokeWidth="1.8" width="7" x="8.5" y="2.5" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </Icon>
);

const StopIcon = () => (
  <Icon>
    <rect fill="currentColor" height="11" rx="2" width="11" x="6.5" y="6.5" />
  </Icon>
);

const PaperclipIcon = () => (
  <Icon>
    <path d="m9 12.5 5.8-5.8a3 3 0 1 1 4.2 4.2l-7.7 7.7a5 5 0 0 1-7.1-7.1l7.4-7.4M7 14.5l7.2-7.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </Icon>
);

const SendIcon = () => (
  <Icon>
    <path d="m21 3-8.2 18-2.1-7.7L3 10.8 21 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="m10.7 13.3 4.4-4.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </Icon>
);

const CloseIcon = () => (
  <Icon size={16}>
    <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
  </Icon>
);

const TrashIcon = () => (
  <Icon size={16}>
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </Icon>
);

export default function ContactAdmin({ initialPartnerId, user, onRefresh }) {
  const { t, language } = useLanguage();
  const label = (ru, ky) => language === "ru" ? ru : ky;
  const [chatSearch, setChatSearch] = useState("");
  const [chatSort, setChatSort] = useState("recent");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [mobileThread, setMobileThread] = useState(Boolean(initialPartnerId || sessionStorage.getItem(`munara:open-chat:${user?.id}`)));
  const [composerFocused,setComposerFocused]=useState(false);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const sync=()=>{
      document.documentElement.style.setProperty('--chat-visible-height',`${viewport?.height||window.innerHeight}px`);
      document.documentElement.style.setProperty('--chat-visible-top',`${viewport?.offsetTop||0}px`);
    };
    const focus=()=>setComposerFocused(Boolean(document.activeElement?.closest('.admin-chat__composer')));
    sync();viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);
    window.addEventListener('resize',sync);document.addEventListener('focusin',focus);document.addEventListener('focusout',focus);
    return()=>{viewport?.removeEventListener('resize',sync);viewport?.removeEventListener('scroll',sync);window.removeEventListener('resize',sync);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus);};
  },[]);
  const isAdmin = user?.role === "admin";
  const isRegional = user?.role === "regional";
  const isOutpost = user?.role === "outpost" && !isTrainingUnit(user?.unit_type);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [olderCursor, setOlderCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const chatRequest = useRef(null);
  const conversation = useRef(null);
  const scrollAnchor = useRef(null);
  const autoScroll = useRef(true);
  useEffect(() => () => chatRequest.current?.abort(), []);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(
    sessionStorage.getItem(`munara:open-chat:${user?.id}`) || (initialPartnerId ? String(initialPartnerId) : "")
  );
  const [selectedAdminGroup, setSelectedAdminGroup] = useState("all");
  const [selectedRegionalGroup, setSelectedRegionalGroup] = useState("admin");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [activeEmojiGroup, setActiveEmojiGroup] = useState(EMOJI_GROUPS[0].id);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState(null);

  useEffect(() => {const open = () => {const id=sessionStorage.getItem(`munara:open-chat:${user?.id}`);if(id){setSelectedUserId(id);setMobileThread(true);setSelectedAdminGroup("all");sessionStorage.removeItem(`munara:open-chat:${user?.id}`);}};open();window.addEventListener("munara:open-chat",open);return()=>window.removeEventListener("munara:open-chat",open);},[user?.id]);
  const isOutpostBroadcast = (isAdmin || isOutpost) && selectedUserId === OUTPOST_BROADCAST_ID;
  const selectedPartner = useMemo(
    () => isOutpostBroadcast
      ? { id: OUTPOST_BROADCAST_ID, full_name: "Жалпы топ", role: "outpost-group" }
      : users.find((item) => String(item.id) === String(selectedUserId)),
    [isOutpostBroadcast, selectedUserId, users]
  );
  const groupedUsers = useMemo(
    () => {
      if (isAdmin) {
        return users.filter((item) => selectedAdminGroup === "all" || item.role === selectedAdminGroup);
      }
      if (isRegional) {
        return users.filter((item) => item.role === selectedRegionalGroup);
      }
      return users;
    },
    [isAdmin, isRegional, selectedAdminGroup, selectedRegionalGroup, users]
  );

  const displayedUsers = useMemo(() => groupedUsers.filter(item => {
    const matches = [item.full_name,item.email,item.region,item.outpost_name].join(" ").toLowerCase().includes(chatSearch.toLowerCase());
    return matches && (!unreadOnly || Number(item.unreadChatCount)>0);
  }).sort((a,b) => {
    const unreadDiff=Number(Number(b.unreadChatCount||0)>0)-Number(Number(a.unreadChatCount||0)>0);
    if(unreadDiff)return unreadDiff;
    if(chatSort === "name")return getDisplayName(a).localeCompare(getDisplayName(b),language);
    if(chatSort === "unread") {const diff=Number(b.unreadChatCount||0)-Number(a.unreadChatCount||0);if(diff)return diff;}
    return (Date.parse(b.lastMessageAt)||0)-(Date.parse(a.lastMessageAt)||0) || getDisplayName(a).localeCompare(getDisplayName(b),language);
  }),[groupedUsers,chatSearch,unreadOnly,chatSort,language]);

  const unreadCounts = useMemo(() => {
    const counts = {};

    messages.forEach((message) => {
      if (message.isRead) {
        return;
      }
      if (String(message.recipient?.id) !== String(user?.id)) {
        return;
      }

      const partnerId = String(message.sender?.id);
      counts[partnerId] = (counts[partnerId] || 0) + 1;
    });

    return counts;
  }, [messages, user?.id]);

  const totalUnreadCount = useMemo(
    () => users.reduce(
      (sum, item) => sum + Number(item.unreadChatCount || unreadCounts[String(item.id)] || 0),
      0
    ),
    [unreadCounts, users]
  );
  const partnerGroupUnreadCounts = useMemo(
    () => users.reduce(
      (counts, item) => {
        const count = Number(item.unreadChatCount || unreadCounts[String(item.id)] || 0);
        if (item.role === "admin" || item.role === "regional" || item.role === "outpost") {
          counts[item.role] += count;
        }
        return counts;
      },
      { admin: 0, regional: 0, outpost: 0 }
    ),
    [unreadCounts, users]
  );

  const visibleMessages = useMemo(() => {
    if (isOutpostBroadcast) {
      return messages;
    }
    if (!selectedUserId) {
      return messages;
    }

    return messages.filter(
      (message) =>
        String(message.sender?.id) === String(selectedUserId) ||
        String(message.recipient?.id) === String(selectedUserId)
    );
  }, [isOutpostBroadcast, messages, selectedUserId]);

  const chatPartner = useMemo(() => {
    return selectedPartner;
  }, [selectedPartner]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (scrollAnchor.current) {
      container.scrollTop = scrollAnchor.current.top + container.scrollHeight - scrollAnchor.current.height;
      scrollAnchor.current = null;
    } else if (autoScroll.current) container.scrollTop = container.scrollHeight;
  }, [selectedUserId, visibleMessages.length]);

  const loadUsers = async () => {
    try {
      const data = await getChatPartners();
      let filtered = Array.isArray(data) ? data : [];
      if (isOutpost) {
        filtered = filtered.filter((item) => ["regional", "admin", "outpost", "management"].includes(item.role));
      }
      const initialPartner = initialPartnerId
        ? filtered.find((item) => String(item.id) === String(initialPartnerId))
        : null;
      
      setUsers(filtered);
      setSelectedUserId((current) => {
        if (current === OUTPOST_BROADCAST_ID && (isAdmin || isOutpost)) {
          return current;
        }
        if (initialPartner && !current) {
          return String(initialPartner.id);
        }
        if (current && filtered.some((item) => String(item.id) === String(current))) {
          return current;
        }
        const firstPartner = isAdmin
          ? filtered.find((item) => selectedAdminGroup === "all" || item.role === selectedAdminGroup)
          : isRegional
            ? filtered.find((item) => item.role === selectedRegionalGroup)
          : filtered[0];
        return firstPartner ? String(firstPartner.id) : "";
      });
    } catch {
      setUsers([]);
    }
  };

  const loadMessages = async (partnerId = selectedUserId, silent = false, beforeId = null) => {
    if (document.visibilityState === "hidden" || (window.innerWidth <= 700 && !mobileThread)) return;
    if (silent && chatRequest.current) return;
    chatRequest.current?.abort();
    const controller = new AbortController();
    chatRequest.current = controller;
    const changed = conversation.current !== partnerId;
    const container = messagesContainerRef.current;
    scrollAnchor.current = beforeId && container ? { top: container.scrollTop, height: container.scrollHeight } : null;
    autoScroll.current = changed || (!beforeId && (!silent || !container || container.scrollHeight - container.scrollTop - container.clientHeight < 100));
    conversation.current = partnerId;
    if (changed) { setMessages([]); setOlderCursor(null); }
    if (beforeId) setLoadingOlder(true);
    else if (!silent) setLoading(true);
    setError("");
    try {
      const params = {
        paged: "1", limit: 50,
        ...(partnerId === OUTPOST_BROADCAST_ID ? { scope: "outpost_broadcast" } : partnerId ? { user_id: partnerId } : {}),
        ...(beforeId ? { beforeId } : {}),
      };
      const data = await getAdminChatMessages(params, controller.signal);
      if (controller.signal.aborted) return;
      let items = data.results;
      // A busy conversation can receive more than one page between polls.
      // Fill the gap before merging the latest window into the visible history.
      const previousNewest = !changed && silent ? messagesRef.current.at(-1)?.id : null;
      let gapCursor = data.nextCursor;
      while (previousNewest && items.length && items[0].id > previousNewest && gapCursor) {
        const gap = await getAdminChatMessages({ ...params, beforeId: gapCursor }, controller.signal);
        if (controller.signal.aborted) return;
        items = [...gap.results, ...items];
        gapCursor = gap.nextCursor;
      }
      if (!changed && silent && !beforeId && previousNewest) {
        const incoming=items.filter(item=>item.id>previousNewest && String(item.sender?.id)!==String(user?.id)).at(-1);
        if(incoming)playMessageSound(`${user?.id}:${incoming.sender?.id}:${incoming.createdAt}`);
      }
      setMessages((previous) => {
        const retained = beforeId ? previous : !changed && silent && items.length
          ? previous.filter((item) => item.id < items[0].id) : [];
        const merged = [...new Map([...retained, ...items].map((item) => [item.id, item])).values()].sort((a, b) => a.id - b.id);
        if (partnerId !== OUTPOST_BROADCAST_ID || !isAdmin) return merged;
        const seen = new Set();
        return merged.filter((item) => {
          const key = item.broadcastId || [item.body, item.attachment_name, String(item.createdAt || "").slice(0,19)].join("|");
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
      });
      if (beforeId || changed || !silent) setOlderCursor(data.nextCursor);
      if (partnerId) {
        setUsers((items) => items.map((item) =>
          String(item.id) === String(partnerId)
            ? { ...item, unreadChatCount: 0 }
            : item
        ));
        window.dispatchEvent(new Event("chat-messages-read"));
      }
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError?.response?.data?.detail || "Билдирмелерди жүктөө мүмкүн болгон жок.");
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingOlder(false); }
      if (chatRequest.current === controller) chatRequest.current = null;
    }
  };

  useEffect(() => {
    loadUsers();
    const poll = window.setInterval(loadUsers, 10000);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(String(users[0].id));
      return;
    }

    loadMessages(selectedUserId);
    if (!selectedUserId) return undefined;
    const intervalId = window.setInterval(
      () => loadMessages(selectedUserId, true),
      5000
    );
    return () => { window.clearInterval(intervalId); chatRequest.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, mobileThread]);

  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = window.setInterval(
      () => setRecordingSeconds((seconds) => seconds + 1),
      1000
    );
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const addEmoji = (emoji) => {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? body.length;
    const end = input?.selectionEnd ?? body.length;
    const nextBody = `${body.slice(0, start)}${emoji}${body.slice(end)}`;
    setBody(nextBody);
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Бул браузер үн жаздырууну колдобойт.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = "audio/webm;codecs=opus";
      const options = MediaRecorder.isTypeSupported(preferredType)
        ? { mimeType: preferredType }
        : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          setFile(new File([blob], `voice-${Date.now()}.webm`, { type: mimeType }));
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setIsRecording(false);
      };

      setError("");
      setRecordingSeconds(0);
      setIsRecording(true);
      recorder.start();
    } catch {
      setError("Микрофонго уруксат берилген жок.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = body.trim();

    if (!trimmed && !file) {
      setError("Текст жазыңыз же тиркеме кошуңуз.");
      return;
    }

    if (isRecording) {
      setError("Үн жаздырууну токтотуңуз.");
      return;
    }

    if (!selectedUserId) {
      setError("Колдонуучуну тандаңыз.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      if (trimmed) {
        formData.append("body", trimmed);
      }
      if (file) {
        formData.append("attachment", file);
        formData.append("attachment_kind", getAttachmentKind(file));
        formData.append("attachment_name", file.name);
      }
      if (isOutpostBroadcast) {
        const result = await createOutpostBroadcastMessage(formData);
        setNotice(`Билдирүү ${result.recipientCount} заставага жөнөтүлдү.`);
      } else {
        formData.append("recipientId", selectedUserId);
        await createAdminChatMessage(formData);
      }
      setBody("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadMessages();
      await loadUsers();
      onRefresh?.();
    } catch (requestError) {
      const responseError = requestError?.response?.data;
      const firstError =
        responseError?.body?.[0] ||
        responseError?.recipientId?.[0] ||
        responseError?.detail ||
        "Билдирүүнү жөнөтүү мүмкүн болгон жок.";
      setError(firstError);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (message, mode) => {
    if (
      mode === "everyone" &&
      !window.confirm("Бул билдирүүнү баарынан өчүрөсүзбү?")
    ) {
      return;
    }

    try {
      setError("");
      await deleteAdminChatMessage(message.id, mode);
      setDeleteMenuMessageId(null);
      await loadMessages();
      onRefresh?.();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail || "Билдирүүнү өчүрүү мүмкүн болгон жок."
      );
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedPartner) return;
    if (!window.confirm(`«${getDisplayName(selectedPartner)}» менен болгон чат эки тараптан тең өчүрүлсүнбү?`)) {
      return;
    }
    try {
      setError("");
      await deleteAdminChatConversation(selectedPartner.id);
      setMessages([]);
      await loadUsers();
      onRefresh?.();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Чатты өчүрүү мүмкүн болгон жок.");
    }
  };

  const currentThreadName = chatPartner
    ? getDisplayName(chatPartner)
    : "Колдонуучуну тандаңыз";
  const partnerAvatar = getAvatarSource(chatPartner);

  return (
    <section className={`module-panel admin-chat messenger-chat${mobileThread ? " is-thread-open" : ""}${composerFocused ? " is-composing" : ""}`}>
      <header className="module-header">
        <div className="admin-chat__page-heading">
          <span className="admin-chat__page-icon"><ChatIcon /></span>
          <div>
          <p><T>{isAdmin ? "Колдонуучулар менен кат алышуу" : "Байланыш"}</T></p>
          <h1><T>{trainingContactLabel(user) || (isOutpost ? "Аскер бөлүгү менен байланыш" : "Колдонуучулар менен байланыш")}</T></h1>
          <span className="admin-chat__subtitle">
            <T>{isAdmin
              ? "Сол жактан колдонуучуну тандап, оң жакка билдирүү жазыңыз."
              : "Адресатты тандап, текст, фото, видео жана документ жөнөтсөңүз болот."}</T>
          </span>
          </div>
        </div>
        {totalUnreadCount > 0 ? <div className="admin-chat__counter"><T>{"Новых: "}</T>{totalUnreadCount}</div> : null}
      </header>

      {broadcastOpen && isAdmin && <ChatBroadcastDialog users={users} onClose={()=>setBroadcastOpen(false)} onSent={count=>{setNotice(label("Рассылка отправлена. Получателей: ","Билдирүү жөнөтүлдү. Алуучулар: ")+count);loadUsers();loadMessages();}}/>}
      <div className="admin-chat__layout">
        {(
          <aside className="admin-chat__sidebar">
            <strong className="admin-chat__sidebar-title">
              <ChatIcon /> <span>{label("Чаты", "Чаттар")}</span>
            </strong>
            <div className="chat-list-controls"><input aria-label={label("Поиск диалогов","Чаттарды издөө")} placeholder={label("Поиск имени, части, заставы…","Аты, бөлүгү, застава…")} value={chatSearch} onChange={e=>setChatSearch(e.target.value)}/><select aria-label={label("Сортировка диалогов","Чаттарды иреттөө")} value={chatSort} onChange={e=>setChatSort(e.target.value)}><option value="recent">{label("Сначала новые сообщения","Жаңы билдирүүлөр биринчи")}</option><option value="unread">{label("Сначала непрочитанные","Окула электер биринчи")}</option><option value="name">{label("По имени","Аты боюнча")}</option></select><label><input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/>{label("Непрочитанные","Окула элек")}</label>{isAdmin && <button type="button" className="chat-new-broadcast" onClick={()=>setBroadcastOpen(true)}>＋ {label("Рассылка","Таратуу")}</button>}</div>
            {isAdmin ? (
              <div className="admin-chat__recipient-sections">
                <button type="button" className={selectedAdminGroup==="all"?"is-active":""} onClick={()=>setSelectedAdminGroup("all")}>{label("Все","Баары")}</button>
                <button
                  className={selectedAdminGroup === "regional" ? "is-active" : ""}
                  onClick={() => {
                    setSelectedAdminGroup("regional");
                    const firstRegional = users.find((item) => item.role === "regional");
                    setSelectedUserId(firstRegional ? String(firstRegional.id) : "");
                  }}
                  type="button"
                ><T>{"Аскер бөлүгү"}</T>{partnerGroupUnreadCounts.regional > 0 ? (
                    <em>{partnerGroupUnreadCounts.regional}</em>
                  ) : null}
                </button>
                <button
                  className={selectedAdminGroup === "outpost" ? "is-active" : ""}
                  onClick={() => {
                    setSelectedAdminGroup("outpost");
                    setSelectedUserId(OUTPOST_BROADCAST_ID);
                  }}
                  type="button"
                ><T>{"Заставалар"}</T>{partnerGroupUnreadCounts.outpost > 0 ? (
                    <em>{partnerGroupUnreadCounts.outpost}</em>
                  ) : null}
                </button>
              </div>
            ) : null}
            {isRegional ? (
              <div className="admin-chat__recipient-sections">
                <button
                  className={selectedRegionalGroup === "admin" ? "is-active" : ""}
                  onClick={() => {
                    setSelectedRegionalGroup("admin");
                    const firstAdmin = users.find((item) => item.role === "admin");
                    setSelectedUserId(firstAdmin ? String(firstAdmin.id) : "");
                  }}
                  type="button"
                ><T>{"Администратор"}</T>{partnerGroupUnreadCounts.admin > 0 ? (
                    <em>{partnerGroupUnreadCounts.admin}</em>
                  ) : null}
                </button>
                <button
                  className={selectedRegionalGroup === "outpost" ? "is-active" : ""}
                  onClick={() => {
                    setSelectedRegionalGroup("outpost");
                    const firstOutpost = users.find((item) => item.role === "outpost");
                    setSelectedUserId(firstOutpost ? String(firstOutpost.id) : "");
                  }}
                  type="button"
                ><T>{"Заставалар"}</T>{partnerGroupUnreadCounts.outpost > 0 ? (
                    <em>{partnerGroupUnreadCounts.outpost}</em>
                  ) : null}
                </button>
              </div>
            ) : null}
            <div className="admin-chat__user-list">
              {isOutpost || (isAdmin && selectedAdminGroup === "outpost") ? (
                <button
                  className={isOutpostBroadcast ? "is-active" : ""}
                  onClick={() => { setSelectedUserId(OUTPOST_BROADCAST_ID); setMobileThread(true); }}
                  type="button"
                >
                  <span className="admin-chat__user-avatar"><T>{"БЗ"}</T></span>
                  <span className="admin-chat__user-info">
                    <span className="admin-chat__user-title"><T>{"Жалпы топ"}</T></span>
                    <small><T>{"Бардык заставалар"}</T></small>
                  </span>
                </button>
              ) : null}
              {displayedUsers.length === 0 ? (
                <span className="admin-chat__empty"><T>{"Нет активных пользователей."}</T></span>
              ) : (
                displayedUsers.map((item) => (
                  <button
                    key={item.id}
                    className={[String(selectedUserId) === String(item.id) ? "is-active" : "", Number(item.unreadChatCount || unreadCounts[String(item.id)]) > 0 ? "has-unread" : ""].filter(Boolean).join(" ")}
                    onClick={() => { setSelectedUserId(String(item.id)); setMobileThread(true); }}
                    type="button"
                  >
                    <span className="admin-chat__user-avatar">
                      {getAvatarSource(item) ? (
                        <img alt="" src={getAvatarSource(item)} />
                      ) : (
                        getInitials(item)
                      )}
                    </span>
                    <span className="admin-chat__user-info">
                      <span className="admin-chat__user-title">
                        <T>{isOutpost
                          ? item.role === "admin"
                            ? "Администратор"
                            : item.role === "outpost" ? "Застава" : item.role === "management" ? "Управление" : "Аскер бөлүгү"
                          : getDisplayName(item)}</T>
                        {(unreadCounts[String(item.id)] || item.unreadChatCount) ? (
                          <em className="admin-chat__badge">
                            {unreadCounts[String(item.id)] || item.unreadChatCount}
                          </em>
                        ) : null}
                      </span>
                      <small>
                        {isOutpost
                          ? getDisplayName(item)
                          : item.outpost_name || item.region || item.email}
                      </small>
                      {item.lastMessageAt && <small className="chat-last-message">{item.lastMessageFromMe?label("Вы: ","Сиз: "):""}{item.lastMessagePreview || label("Сообщение","Билдирүү")}</small>}
                      {item.lastMessageAt && <time className="chat-last-time">{new Date(item.lastMessageAt).toLocaleTimeString(language==='ru'?'ru-RU':'ky-KG',{hour:'2-digit',minute:'2-digit'})}</time>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}

        <div className="admin-chat__thread">
          <div className="admin-chat__thread-head">
            <button type="button" className="messenger-back" aria-label={label("Назад к чатам","Чаттарга кайтуу")} onClick={()=>setMobileThread(false)}>←</button>
            <div className="admin-chat__partner">
              <div className="admin-chat__partner-avatar">
                {partnerAvatar ? (
                  <img alt={currentThreadName} src={partnerAvatar} />
                ) : (
                  <span>{getInitials(chatPartner)}</span>
                )}
              </div>
              <div>
                <strong>{currentThreadName}</strong>
                <span>
                  <T>{selectedPartner
                    ? selectedPartner.email || selectedPartner.region
                    : "Сол жактан адамды тандаңыз"}</T>
                </span>
              </div>
            </div>
            {isAdmin && selectedPartner && !isOutpostBroadcast ? (
              <button className="danger" onClick={handleDeleteConversation} type="button"><T>{"Чатты өчүрүү"}</T></button>
            ) : null}
          </div>

          <div className="admin-chat__messages" ref={messagesContainerRef}>
            {olderCursor ? <button type="button" disabled={loadingOlder} onClick={() => loadMessages(selectedUserId, false, olderCursor)}><T>{loadingOlder ? "Жүктөлүүдө..." : "Мурунку билдирүүлөр"}</T></button> : null}
            {isOutpostBroadcast ? (
              <div className="admin-chat__empty">
                <strong><T>{"Бардык заставалар"}</T></strong>
                <span>
                  <T>{isAdmin
                    ? "Бул жерден жөнөтүлгөн билдирүү бардык активдүү заставаларга жетет."
                    : "Бул топко билдирүүнү администратор гана жөнөтөт."}</T>
                </span>
                {isAdmin && notice ? <span className="dashboard-notice">{notice}</span> : null}
              </div>
            ) : null}
            {loading ? (
              <div className="admin-chat__empty"><T>{"Билдирмелер жүктөлүүдө..."}</T></div>
            ) : visibleMessages.length === 0 ? (
              <div className="admin-chat__empty"><T>{"Билдирүүлөр азырынча жок."}</T></div>
            ) : (
              visibleMessages.map((message) => {
                const isOwn = String(message.sender?.id) === String(user?.id);
                const attachmentUrl = message.attachment;
                const attachmentName = message.attachment_name || attachmentUrl?.split("/").pop();
                const kind = message.attachment_kind || getAttachmentKind({ name: attachmentName || "", type: "" });
                const senderAvatar = getAvatarSource(message.sender);
                const isAdminMessage = message.sender?.role === "admin";
                const isDeletedForEveryone = message.isDeletedForEveryone;
                const messageClassName = [
                  "admin-chat__message",
                  isOwn ? "admin-chat__message--own" : "",
                  isAdminMessage
                    ? "admin-chat__message--admin"
                    : "admin-chat__message--user",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article
                    className={messageClassName}
                    key={message.id}
                  >
                    <div className="admin-chat__message-avatar">
                      {senderAvatar ? (
                        <img alt="" src={senderAvatar} />
                      ) : (
                        <span>{getInitials(message.sender)}</span>
                      )}
                    </div>
                    <div className="admin-chat__bubble">
                      <div className="admin-chat__meta">
                        <div className="admin-chat__message-author">
                          <strong><T>{isOwn ? "Сиз" : getDisplayName(message.sender)}</T></strong>
                          <em>
                            <T>{isAdminMessage ? "Администратор" : "Колдонуучу"}</T>
                          </em>
                        </div>
                        {message.isBroadcast && !isAdmin ? (
                          <span>{formatTime(message.createdAt)}</span>
                        ) : (
                        <div className="admin-chat__message-menu-wrap">
                          <span>{formatTime(message.createdAt)}</span>
                          <button
                            aria-label={t("Билдирүүнү өчүрүү")}
                            className="admin-chat__message-menu-button"
                            onClick={() =>
                              setDeleteMenuMessageId((currentId) =>
                                currentId === message.id ? null : message.id
                              )
                            }
                            title="Өчүрүү"
                            type="button"
                          >
                            <TrashIcon />
                          </button>
                          {deleteMenuMessageId === message.id ? (
                            <div className="admin-chat__message-menu">
                              <button
                                onClick={() => handleDeleteMessage(message, "self")}
                                type="button"
                              ><T>{"Өзүмдөн өчүрүү"}</T></button>
                              {isOwn && !isDeletedForEveryone ? (
                                <button
                                  onClick={() => handleDeleteMessage(message, "everyone")}
                                  type="button"
                                ><T>{"Баарынан өчүрүү"}</T></button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        )}
                      </div>
                      {isDeletedForEveryone ? (
                        <p className="admin-chat__deleted-message"><T>{"Данное сообщение было удалено"}</T></p>
                      ) : message.body ? (
                        <p>{message.body}</p>
                      ) : null}
                      {!isDeletedForEveryone && attachmentUrl ? (
                        kind === "image" ? (
                          <img alt={attachmentName} className="admin-chat__media" src={attachmentUrl} />
                        ) : kind === "video" ? (
                          <video className="admin-chat__media" controls src={attachmentUrl} />
                        ) : kind === "audio" ? (
                          <audio className="admin-chat__audio" controls src={attachmentUrl} />
                        ) : (
                          <a className="admin-chat__file" href={attachmentUrl} rel="noreferrer" target="_blank">
                            <T>{attachmentName || "Вложение"}</T>
                          </a>
                        )
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {isOutpostBroadcast && isOutpost ? (
            <div className="admin-chat__composer admin-chat__composer--readonly"><T>{"Жалпы топко билдирүүнү администратор гана жөнөтө алат."}</T></div>
          ) : (
          <form className="admin-chat__composer" onSubmit={handleSubmit}>
            {file && <div className="messenger-attachment">📎 {file.name}<button type="button" aria-label={label("Убрать вложение", "Тиркемени алып салуу")} onClick={()=>{setFile(null);if(fileInputRef.current)fileInputRef.current.value="";}}>✕</button></div>}
            <div className="admin-chat__composer-tools">
              <div className="admin-chat__emoji-wrap">
                <button
                  aria-label={label("Смайлики", "Быйтыкчалар")} title={label("Смайлики", "Быйтыкчалар")} aria-expanded={isEmojiPickerOpen}
                  onClick={() => setIsEmojiPickerOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <SmileIcon />
                  <span><T>{"Быйтыкчалар"}</T></span>
                </button>
                {isEmojiPickerOpen ? (
                  <div className="admin-chat__emoji-picker">
                    <div className="admin-chat__emoji-tabs">
                      {EMOJI_GROUPS.map((group) => (
                        <button
                          aria-label={group.label}
                          className={activeEmojiGroup === group.id ? "is-active" : ""}
                          key={group.id}
                          onClick={() => setActiveEmojiGroup(group.id)}
                          title={group.label}
                          type="button"
                        >
                          {group.icon}
                        </button>
                      ))}
                    </div>
                    <strong>
                      {EMOJI_GROUPS.find((group) => group.id === activeEmojiGroup)?.label}
                    </strong>
                    <div className="admin-chat__emoji-grid">
                      {EMOJI_GROUPS.find((group) => group.id === activeEmojiGroup)?.emojis.map(
                        (emoji) => (
                          <button key={emoji} onClick={() => addEmoji(emoji)} type="button">
                            {emoji}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                aria-label={isRecording ? label("Остановить запись", "Жазууну токтотуу") : label("Голосовое сообщение", "Үн билдирүү")} title={label("Голосовое сообщение", "Үн билдирүү")} className={isRecording ? "admin-chat__voice-button is-recording" : "admin-chat__voice-button"}
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                type="button"
              >
                {isRecording
                  ? <><StopIcon /><span><T>{"Токтотуу "}</T>{String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}</span></>
                  : <><MicIcon /><span><T>{"Үн билдирүү"}</T></span></>}
              </button>
            </div>
            <textarea
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!sending) handleSubmit(event); } }}
              aria-label={label("Сообщение", "Билдирүү")} placeholder={label("Введите сообщение", "Билдирүү жазыңыз")}
              ref={messageInputRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
            />

            <div className="admin-chat__composer-row">
              <div className="admin-chat__file-block">
                <label title={label("Прикрепить файл", "Файл тиркөө")} aria-label={label("Прикрепить файл", "Файл тиркөө")} className="admin-chat__file-button" htmlFor="admin-chat-file">
                  <PaperclipIcon />
                  <span><T>{"Файл тандоо"}</T></span>
                </label>
                <input
                  accept={FILE_ACCEPT}
                  className="admin-chat__file-input"
                  id="admin-chat-file"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              <button aria-label={label("Отправить сообщение", "Билдирүү жөнөтүү")} title={label("Отправить сообщение", "Билдирүү жөнөтүү")} className="admin-chat__send-button" disabled={sending} type="submit">
                <SendIcon />
                <span><T>{sending ? "Жөнөтүлүүдө..." : "Жөнөтүү"}</T></span>
              </button>
            </div>

            {error ? <div className="admin-chat__error"><T>{error}</T></div> : null}
          </form>
          )}
        </div>
      </div>
    </section>
  );
}



