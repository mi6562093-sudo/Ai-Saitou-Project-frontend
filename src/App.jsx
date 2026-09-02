import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const BACKEND_URL = "https://ai-saitou-project-production.up.railway.app"
const supabase = createClient(
  "https://kvhoirxniciekdctsxta.supabase.co",
  "sb_publishable_XEnH5zPGF0xG48FuKnC3Wg_jWXKKzgA"
)

function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [showMemori, setShowMemori] = useState(false)
  const [memoriList, setMemoriList] = useState([])
  const [loadingMemori, setLoadingMemori] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setMessages([])
  }

  async function sendMessage() {
    if (!input.trim()) return
    const pesanUser = input
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }])
    setChatLoading(true)
    try {
      const res = await fetch(
        `${BACKEND_URL}/chat?pesan=${encodeURIComponent(pesanUser)}&user_id=${encodeURIComponent(session.user.id)}`,
        { method: 'POST' }
      )
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'ai', text: data.jawaban || 'Tidak ada jawaban' }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Error: gagal menghubungi backend' }])
    } finally {
      setChatLoading(false)
    }
  }

  async function ambilMemori() {
    setLoadingMemori(true)
    try {
      const res = await fetch(`${BACKEND_URL}/memori/${encodeURIComponent(session.user.id)}`)
      const data = await res.json()
      setMemoriList(Array.isArray(data) ? data : [])
    } catch (err) {
      setMemoriList([])
    } finally {
      setLoadingMemori(false)
    }
  }

  function toggleMemori() {
    const akanTampil = !showMemori
    setShowMemori(akanTampil)
    if (akanTampil) ambilMemori()
  }

  async function hapusMemoriItem(memoriId) {
    try {
      await fetch(
        `${BACKEND_URL}/memori/${encodeURIComponent(session.user.id)}/${encodeURIComponent(memoriId)}`,
        { method: 'DELETE' }
      )
      setMemoriList((prev) => prev.filter((m) => m.id !== memoriId))
    } catch (err) {
      alert('Gagal menghapus memori')
    }
  }

  if (checkingSession) {
    return <div style={{ textAlign: 'center', marginTop: 50 }}>Memuat...</div>
  }

  if (!session) {
    return (
      <div style={{ maxWidth: 400, margin: '60px auto', padding: 20, fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1>Saitou-AI</h1>
        <p style={{ color: '#888', marginBottom: 24 }}>Masuk untuk mulai mengobrol</p>
        <button
          onClick={handleGoogleLogin}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            padding: '12px 20px',
            fontSize: 16,
            borderRadius: 8,
            border: '1px solid #ccc',
            background: 'white',
            color: '#333',
            cursor: 'pointer',
          }}
        >
          Login dengan Google
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 500, margin: '20px auto', padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Saitou-AI</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleMemori}>{showMemori ? 'Tutup Memori' : 'Kelola Memori'}</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <p style={{ color: '#888', marginTop: -10 }}>{session.user.email}</p>

      {showMemori && (
        <div style={{ border: '1px solid #ccc', borderRadius: 10, padding: 15, marginBottom: 10 }}>
          <h3 style={{ marginTop: 0 }}>Memori Tersimpan</h3>
          {loadingMemori && <p>Memuat memori...</p>}
          {!loadingMemori && memoriList.length === 0 && <p style={{ color: '#888' }}>Belum ada memori tersimpan.</p>}
          {!loadingMemori && memoriList.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '8px 0' }}>
              <span style={{ flex: 1, marginRight: 10 }}>{m.isi}</span>
              <button onClick={() => hapusMemoriItem(m.id)} style={{ color: 'red', cursor: 'pointer' }}>Hapus</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ border: '1px solid #ccc', borderRadius: 10, padding: 15, minHeight: 300, marginBottom: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <span style={{
              display: 'inline-block',
              padding: '8px 12px',
              borderRadius: 12,
              background: m.role === 'user' ? '#3b82f6' : '#e5e7eb',
              color: m.role === 'user' ? 'white' : 'black',
              maxWidth: '80%',
            }}>
              {m.text}
            </span>
          </div>
        ))}
        {chatLoading && <p>Mengetik...</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Tulis pesan..."
          style={{ flex: 1, padding: 10, fontSize: 16 }}
        />
        <button onClick={sendMessage} disabled={chatLoading}>Kirim</button>
      </div>
    </div>
  )
}

export default App
