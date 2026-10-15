import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function Bell({ to }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () =>
      axios
        .get("http://localhost:8000/api/notifications/unread-count")
        .then((res) => setCount(res.data.count))
        .catch(() => {});
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Link to={to} className="bell">
      Notifications
      {count > 0 && <span className="count">{count}</span>}
    </Link>
  );
}

export default Bell;