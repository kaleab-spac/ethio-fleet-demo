import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:8000/api/notifications/";

function formatTime(iso) {
  return new Date(iso + "Z").toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const load = () =>
    axios.get(API).then((res) => setItems(res.data)).catch(() => setError(true));

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const open = (n) => {
    const go = () => (n.link ? navigate(n.link) : load());
    if (n.is_read) return go();
    axios.put(`${API}${n.id}/read`).then(go).catch(go);
  };

  const readAll = () => axios.put(API + "read-all").then(load);

  if (error) return <div className="error-box">Cannot load notifications.</div>;
  if (!items) return <p>Loading...</p>;

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="page-head">
        <h2>Notifications ({unread} unread)</h2>
        {unread > 0 && <button className="btn secondary" onClick={readAll}>Mark all as read</button>}
      </div>
      <div className="table-wrap">
        {items.length === 0 && <div className="note-row muted">No notifications yet.</div>}
        {items.map((n) => (
          <div key={n.id} className={`note-row ${n.is_read ? "" : "unread"}`} onClick={() => open(n)}>
            <div className="title">{n.title}</div>
            <div>{n.message}</div>
            <div className="meta">{formatTime(n.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notifications;