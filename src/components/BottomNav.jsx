import { Home, PlusCircle, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const BottomNav = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex justify-center items-center h-16">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
            isActive("/")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="h-6 w-6" />
          <span className="text-xs">Home</span>
        </Link>

        <Link
          to="/create"
          className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
            isActive("/create")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <PlusCircle className="h-6 w-6" />
          <span className="text-xs">Create</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
            isActive("/profile")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-6 w-6" />
          <span className="text-xs">Profile</span>
        </Link>
      </div>
    </nav>
  );
};
