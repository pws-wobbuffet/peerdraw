import React, { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, myName, peerName, onSend, connected }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const msg = input.trim();
    if (!msg) return;
    onSend(msg);
    setInput('');
  };

  return (
    <div className="panel chat-panel">
      <div className="panel-title">Chat</div>

      {connected && peerName && (
        <div className="chat-peer-label">drawing with {peerName}</div>
      )}
      {!connected && (
        <div className="chat-peer-label" style={{ opacity: 0.4 }}>Connect to start chatting</div>
      )}

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={'chat-msg' + (m.from === 'me' ? ' chat-msg-me' : '')}>
            <span className="chat-sender">{m.from === 'me' ? myName || 'You' : m.from}</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          type="text"
          value={input}
          placeholder={connected ? 'Say something…' : '—'}
          disabled={!connected}
          maxLength={200}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button type="button" className="btn btn-primary chat-send-btn"
          disabled={!connected || !input.trim()}
          onClick={send}>
          →
        </button>
      </div>
    </div>
  );
}
