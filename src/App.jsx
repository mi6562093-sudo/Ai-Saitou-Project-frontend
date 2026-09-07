import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { mintaIzinDanAmbilToken, dengarkanNotifikasiForeground } from './firebase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('saitou_welcome_seen')
  )

  const kembangApi = Array.from({ length: 14 }, (_, i) => {
    const sudut = (Math.PI * 2 * i) / 14
    const jarak = 60 + Math.random() * 40
    return {
      id: i,
      emoji: ['🎇', '✨', '🎉'][i % 3],
      tx: Math.cos(sudut) * jarak,
      ty: Math.sin(sudut) * jarak,
      delay: Math.random() * 0.3,
      left: 45 + Math.random() * 10,
      top: 40 + Math.random() * 10,
    }
  })

  function tutupWelcome() {
    localStorage.setItem('saitou_welcome_seen', '1')
    setShowWelcome(false)
  }

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

  useEffect(() => {
    if (!session) return

    supabase.realtime.setAuth(session.access_token)

    const channel = supabase
      .channel('memori-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memori', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          setMemoriList((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'memori', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          setMemoriList((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollLeft = 0
    document.body.scrollLeft = 0
  }, [messages])

  useEffect(() => {
    if (!session) return

    async function daftarkanNotifikasi() {
      const token = await mintaIzinDanAmbilToken()
      if (token) {
        try {
          await fetch(
            `${BACKEND_URL}/device-token?user_id=${encodeURIComponent(session.user.id)}&token=${encodeURIComponent(token)}`,
            { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}` } }
          )
        } catch (err) {
          console.error('Gagal simpan device token:', err)
        }
      }
    }
    daftarkanNotifikasi()

    dengarkanNotifikasiForeground((payload) => {
      alert(payload.notification?.title + '\n' + payload.notification?.body)
    })
  }, [session])

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

    const riwayat = messages.slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))

    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }])
    setChatLoading(true)
    try {
      const res = await fetch(
        `${BACKEND_URL}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            pesan: pesanUser,
            user_id: session.user.id,
            riwayat: riwayat,
          }),
        }
      )
      if (res.status === 401 || res.status === 403) {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Sesi login kamu sudah tidak valid. Coba logout lalu login lagi ya.' }])
        return
      }
      if (res.status === 429) {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Kamu mengirim pesan terlalu cepat. Tunggu sebentar ya sebelum kirim lagi.' }])
        return
      }
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
      const res = await fetch(
        `${BACKEND_URL}/memori/${encodeURIComponent(session.user.id)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
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
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } }
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
    <div style={{ maxWidth: 500, margin: '20px auto', padding: 20, fontFamily: 'sans-serif', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
      {showWelcome && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            position: 'relative', background: '#1a1a1a', color: '#eee',
            borderRadius: 16, padding: 24, maxWidth: 380, textAlign: 'center',
            border: '1px solid #444', overflow: 'hidden',
          }}>
            {kembangApi.map((p) => (
              <span
                key={p.id}
                className="firework-particle"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDelay: `${p.delay}s`,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                }}
              >
                {p.emoji}
              </span>
            ))}
            <h2 style={{ marginTop: 0 }}>Halo, para Beta Tester yang luar biasa! 🌟</h2>
            <p style={{ lineHeight: 1.6 }}>
              Terima kasih sudah bergabung dan membantu kami memperbaiki platform ini. Tanpa kalian, inovasi kami tidak akan secepat ini. Selamat menjelajah, memberi masukan, dan bersenang-senang — semoga pengalaman kalian menyenangkan dan penuh inspirasi! 🎉
            </p>
            <p style={{ fontStyle: 'italic', color: '#aaa' }}>Sampai jumpa di setiap update berikutnya!</p>
            <button
              onClick={tutupWelcome}
              style={{
                marginTop: 12, padding: '8px 20px', borderRadius: 8,
                border: 'none', background: '#3b82f6', color: 'white',
                fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              Mulai Jelajahi
            </button>
          </div>
        </div>
      )}
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
            <div style={{
              display: 'inline-block',
              padding: '8px 12px',
              borderRadius: 12,
              background: m.role === 'user' ? '#3b82f6' : '#e5e7eb',
              color: m.role === 'user' ? 'white' : 'black',
              maxWidth: '80%',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              textAlign: 'left',
            }}>
              {m.role === 'ai' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({node, ...props}) => (
                      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                        <table style={{ borderCollapse: 'collapse', width: 'max-content' }} {...props} />
                      </div>
                    ),
                    th: ({node, ...props}) => (
                      <th style={{ border: '1px solid #999', padding: '4px 8px', whiteSpace: 'nowrap', verticalAlign: 'top' }} {...props} />
                    ),
                    td: ({node, ...props}) => (
                      <td style={{ border: '1px solid #999', padding: '4px 8px', whiteSpace: 'nowrap', verticalAlign: 'top' }} {...props} />
                    ),
                    h1: ({node, ...props}) => <h1 style={{ color: 'black' }} {...props} />,
                    h2: ({node, ...props}) => <h2 style={{ color: 'black' }} {...props} />,
                    h3: ({node, ...props}) => <h3 style={{ color: 'black' }} {...props} />,
                    h4: ({node, ...props}) => <h4 style={{ color: 'black' }} {...props} />,
                    pre: ({node, ...props}) => (
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'break-word', maxWidth: '100%', background: '#000', color: '#0f0', padding: 8, borderRadius: 6 }} {...props} />
                    ),
                    code: ({node, ...props}) => (
                      <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'break-word' }} {...props} />
                    ),
                  }}
                >{m.text}</ReactMarkdown>
              ) : (
                m.text
              )}
            </div>
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

      <div style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 10,
        border: '1px solid #333',
        background: '#1a1a1a',
        color: '#ddd',
        fontSize: 14,
        lineHeight: 1.6,
      }}>
        <p style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
          💡📈 Dukung Pengembangan <span style={{ whiteSpace: 'nowrap' }}>Saitou-AI</span>
        </p>
        <p style={{ marginBottom: 8 }}>
          Saitou-AI adalah proyek yang terus dikembangkan secara bertahap. Dukunganmu membantu membiayai server, API, keamanan, dan pengembangan fitur baru — supaya Saitou-AI bisa terus jadi lebih stabil, cerdas, dan mampu melakukan lebih banyak hal ke depannya.
        </p>
        <p style={{ marginBottom: 12 }}>
          Dukungan bersifat <strong>sukarela</strong>, sekecil apa pun sangat berarti — dan bukan cuma bantuan sesaat, tapi bagian dari pertumbuhan Saitou-AI ke depan. Supporter mendapat akses info perkembangan lebih awal dan kesempatan memberi masukan langsung.
        </p>
        <a
          href="https://trakteer.id/Saitou-AI_for_all"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontWeight: 'bold',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          💡📈 Dukung Saitou-AI →
        </a>
        <p style={{ marginTop: 12, fontStyle: 'italic', fontSize: 13, color: '#999' }}>
          Prioritas kami: stabilitas, keamanan, privasi data, lalu kemampuan. Terima kasih sudah jadi bagian dari perjalanan ini. 🚀
        </p>
        <a
          href="mailto:mi6562093@gmail.com?subject=Feedback%20Saitou-AI"
          style={{
            display: 'inline-block',
            marginTop: 12,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #555',
            color: '#ddd',
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          🐞 Kirim Feedback / Lapor Bug
        </a>
      </div>
    </div>
  )
}

export default App
