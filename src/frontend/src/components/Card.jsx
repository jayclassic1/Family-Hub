import { Link } from "react-router-dom";

export default function Card({ to, title, description, emoji }) {
  return (
    <Link to={to} className="card">
      <div className="card-emoji">{emoji}</div>
      <div className="card-title">{title}</div>
      <div className="card-description">{description}</div>
    </Link>
  );
}
