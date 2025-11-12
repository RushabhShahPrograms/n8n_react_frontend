import { Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

function PrivateRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.email?.endsWith("@wholesomegoods.com")) {
    auth.signOut();
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Index />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}