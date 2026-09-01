import { useState } from 'react'
import './App.css'

const USER_ID = "f6a5eee3-1c47-47bb-aae0-c424c3537398"
const BACKEND_URL = "https://ai-saitou-project-production.up.railway.app"

function App() {
  const [pesan, setPesan] = useState("")
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(false)

  const kirimPesan = async () => {
    if (!pesan.trim()) return
    const pesanUser = pesan
    setRiwayat(prev => [...prev, { peran: "user", isi: pesanUser }])
    setPesan("")
    setLoading(true)

    try {
      const url = `${BACKEND_URL}/chat?pesan=${encodeURIComponent(pesanUser)}&user_id=${encodeURIComponent(USER_ID)}`
      const res = await fetch(url, { method: "POST" })
      const data = await res.json()
      setRiwayat(prev => [...prev, { peran: "ai", isi: data.jawaban }])
    } catch (err) {
      setRiwayat(prev => [...prev, { peran: "ai", isi: "Error: gagal menghubungi backend." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") kirimPesan()
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h2>AI Agent Pribadi</h2>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, minHeight: 300, marginBottom: 12 }}>
        {riwayat.map((m, i) => (
          <div key={i} style={{ textAlign: m.peran === "user" ? "right" : "left", margin: "8px 0" }}>
            <span style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 12,
              background: m.peran === "user" ? "#0084ff" : "#e4e6eb",
              color: m.peran === "user" ? "#fff" : "#000",
              maxWidth: "80%"
            }}>
              {m.isi}
            </span>
          </div>
        ))}
        {loading && <div>AI sedang mengetik...</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={pesan}
          onChange={(e) => setPesan(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tulis pesan..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={kirimPesan} disabled={loading}>Kirim</button>
      </div>
    </div>
  )
}

export default App
