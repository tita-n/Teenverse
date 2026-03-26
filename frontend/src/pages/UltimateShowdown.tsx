import { useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { Vote, Play, Upload, Calendar, Video } from "lucide-react";

export default function UltimateShowdown() {
  const [vote, setVote] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState("");
  const [useUrl, setUseUrl] = useState(false);
  const [category, setCategory] = useState("Rap");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, token, loading: authLoading } = useAuth();
  const categories = ["Rap", "Dance", "Singing"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setClipFile(e.target.files[0]);
      setUseUrl(false);
    }
  };

  const handleSubmitClip = async () => {
    if (!user || !token) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("email", user.email);
      formData.append("category", category);
      
      if (useUrl && clipUrl) {
        formData.append("clipUrl", clipUrl);
      } else if (clipFile) {
        formData.append("media", clipFile);
      } else {
        setMessage("Please upload a file or enter a URL");
        return;
      }

      const res = await axios.post("/api/showdown/submit-clip", formData, {
        headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" }
      });
      setMessage("Clip submitted successfully!");
      setClipFile(null);
      setClipUrl("");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Error submitting clip");
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;

  return (
    <Layout maxWidth="3xl">
      <div className="mb-6">
        <h1 className="text-display text-center">Ultimate Showdown</h1>
        <p className="text-tx-secondary text-center mt-1">The ultimate teen talent competition</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("success") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
          {message}
        </div>
      )}

      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Vote className="w-5 h-5 text-brand-500" /> Showdown Status</h2>
        <p className="text-tx-secondary">Check back for tournament announcements and voting.</p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Calendar className="w-5 h-5 text-blue-500" /> Vote for Date</h2>
        <select value={vote} onChange={(e) => setVote(e.target.value)} className="input mb-3">
          <option value="">Select a date</option>
          <option value="2025-04-26">Next Saturday</option>
          <option value="2025-04-27">Next Sunday</option>
        </select>
        <Button disabled={!vote}>Vote</Button>
      </div>

      <div className="card p-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Upload className="w-5 h-5 text-green-500" /> Submit a Clip</h2>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mb-3">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        
        <div className="mb-4">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={useUrl} onChange={(e) => setUseUrl(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">Use URL instead of file upload</span>
          </label>
        </div>

        {useUrl ? (
          <Input value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} placeholder="Enter your clip URL" className="mb-3" />
        ) : (
          <div className="mb-3">
            <input 
              type="file" 
              ref={fileInputRef}
              accept="video/*,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              {clipFile ? (
                <div className="flex items-center justify-center gap-2">
                  <Video className="w-8 h-8 text-brand-500" />
                  <span className="text-sm font-medium">{clipFile.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Click to upload a video or image</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        <Button disabled={uploading || (!clipUrl && !clipFile)} onClick={handleSubmitClip}>
          {uploading ? "Uploading..." : <><Play className="w-4 h-4 mr-2" /> Submit Clip</>}
        </Button>
      </div>
    </Layout>
  );
}
