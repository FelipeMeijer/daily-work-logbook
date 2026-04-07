import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Invalid link.");
      return;
    }

    api.post("/auth/verify", { token })
      .then(({ data }) => {
        login(data.token, data.user);
        navigate("/");
      })
      .catch(() => {
        setError("Link is invalid or expired. Please request a new one.");
      });
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      {error ? (
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <a href="/login" className="mt-4 block text-indigo-400 underline">Back to login</a>
        </div>
      ) : (
        <p className="text-gray-400 text-lg">Signing you in...</p>
      )}
    </div>
  );
}
