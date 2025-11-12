import React from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ScreenLayout } from "@/components/ScreenLayout";


export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // UX hint (not a security boundary)
      provider.setCustomParameters({ hd: "wholesomegoods.com" }); 
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // For testing with your own account, temporarily allow gmail:
      // if (!user.email?.endsWith("@gmail.com")) {  // <-- use this to test
      // For client rollout use:
      if (!user.email?.endsWith("@wholesomegoods.com")) {
        await auth.signOut();
        alert("Please sign in with your @wholesomegoods.com account.");
        return;
      }

      navigate("/");
    } catch (err) {
      console.error("Sign in error", err);
      alert(err.message || "Login failed");
    }
  };

  return (
  <ScreenLayout>
    
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",   // centers horizontally
        justifyContent: "center", // centers vertically inside card
        height: "60vh",          // gives some breathing room
        textAlign: "center",
      }}
    >
      <h1 className="text-2xl font-bold text-white mt-8 mb-6 bg-gradient-primary bg-clip-text text-transparent text-center">
        Welcome to AI Marketing Engine
    </h1>
      <p className="text-sl font-bold text-white mt-2 mb-6 bg-clip-text">Sign in with Google to get started</p>
      <button
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "15px 70px",
          background: "linear-gradient(to right, #3b82f6, #6366f1)",
          color: "white",
          fontWeight: "600",
          borderRadius: "9999px",
          border: "none",
          boxShadow: "0 4px 6px rgba(171, 9, 9, 0.1)",
          transition: "all 0.3s",
          cursor: "pointer",
        }}
        onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
        onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
        onClick={handleLogin}
      >
        Sign in
      </button>
    </div>
  </ScreenLayout>
);
}
