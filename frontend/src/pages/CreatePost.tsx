import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { PenSquare } from "lucide-react";

export default function CreatePost() {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const { user, token, loading: authLoading } = useAuth();

  const handlePost = async () => {
    if (!user || !token || !content.trim()) return;
    try {
      setPosting(true);
      const res = await axios.post("/api/posts/create-post", { email: user.email, content, mode: "main" }, withAuth(token));
      setMessage(res.data.message);
      setContent("");
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setPosting(false);
    }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;

  return (
    <Layout maxWidth="2xl">
      <div className="mb-6">
        <h1 className="text-h1">Create Post</h1>
        <p className="text-tx-secondary mt-1">Share something with the community</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      <div className="card p-6">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          className="mb-4"
        />
        <Button onClick={handlePost} loading={posting} disabled={!content.trim()}>
          <PenSquare className="w-4 h-4 mr-2" />
          Post
        </Button>
      </div>
    </Layout>
  );
}
