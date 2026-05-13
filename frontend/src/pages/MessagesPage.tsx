import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Message } from '../lib/types';

export function MessagesPage() {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [items, setItems] = useState<Message[] | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);

  function load() {
    api<Message[]>(`/messages/${tab}`).then(setItems);
  }
  useEffect(load, [tab]);

  async function open(m: Message) {
    setSelected(m);
    if (tab === 'inbox' && !m.readAt) {
      await api(`/messages/${m.id}/read`, { method: 'POST' });
      load();
    }
  }

  async function remove(id: number) {
    if (!confirm('Διαγραφή μηνύματος;')) return;
    await api(`/messages/${id}?box=${tab}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  }

  return (
    <div className="container">
      <h2>Μηνύματα</h2>
      <div className="row">
        <button className={tab === 'inbox' ? '' : 'secondary'} onClick={() => { setTab('inbox'); setSelected(null); }}>Εισερχόμενα</button>
        <button className={tab === 'sent' ? '' : 'secondary'} onClick={() => { setTab('sent'); setSelected(null); }}>Απεσταλμένα</button>
      </div>
      <div className="grid two" style={{ marginTop: '1rem' }}>
        <div>
          {items === null && <p className="muted">Φορτώνεται…</p>}
          {items && items.length === 0 && <p className="muted">Δεν υπάρχουν μηνύματα.</p>}
          {items && items.map((m) => (
            <div
              key={m.id}
              className="card"
              style={{
                cursor: 'pointer',
                background: selected?.id === m.id ? '#e0f2fe' : undefined,
                fontWeight: tab === 'inbox' && !m.readAt ? 600 : undefined,
              }}
              onClick={() => open(m)}
            >
              <div className="row between">
                <strong>{m.subject}</strong>
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {new Date(m.sentAt).toLocaleDateString()}
                </span>
              </div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {tab === 'inbox'
                  ? `From: ${m.sender?.username ?? '?'}`
                  : `To: ${m.receiver?.username ?? '?'}`}
              </div>
            </div>
          ))}
        </div>
        <div>
          {!selected && <p className="muted">Επιλέξτε ένα μήνυμα για ανάγνωση.</p>}
          {selected && (
            <div className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>{selected.subject}</h3>
                <button className="danger" onClick={() => remove(selected.id)}>Διαγραφή</button>
              </div>
              <div className="muted">
                {tab === 'inbox'
                  ? `Από: ${selected.sender?.firstName} ${selected.sender?.lastName} (${selected.sender?.username})`
                  : `Προς: ${selected.receiver?.firstName} ${selected.receiver?.lastName} (${selected.receiver?.username})`}
                <br />
                {new Date(selected.sentAt).toLocaleString()}
              </div>
              <hr />
              <p style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
