import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { mintaIzinDanAmbilToken, dengarkanNotifikasiForeground } from './firebase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const BACKEND_URL = "https://ai-saitou-project-production.up.railway.app"
const supabase = createClient(
  "https://kvhoirxniciekdctsxta.supabase.co",
  "sb_publishable_XEnH5zPGF0xG48FuKnC3Wg_jWXKKzgA"
)

const C = {
  bg: '#FAF7F1',
  bgElevated: '#F0EBE1',
  bgSidebar: '#F3EEE3',
  text: '#151210',
  textSecondary: '#8A8175',
  accent: '#C9A96A',
  accentDark: '#AD8A4E',
  accentRare: '#6E2430',
  border: '#E4DCC9',
  bubbleUserBg: '#151210',
  bubbleUserText: '#FAF7F1',
}

function mengandungTabelMarkdown(teks) {
  return teks.split('\n').some(
    (baris) => /^[\s|:-]+$/.test(baris) && baris.includes('|') && baris.includes('-')
  )
}

function App() {
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' && window.visualViewport
      ? window.visualViewport.height
      : (typeof window !== 'undefined' ? window.innerHeight : 800)
  )

  useEffect(() => {
    function updateViewportHeight() {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
      } else {
        setViewportHeight(window.innerHeight)
      }
    }
    updateViewportHeight()
    window.visualViewport?.addEventListener('resize', updateViewportHeight)
    window.addEventListener('resize', updateViewportHeight)
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight)
      window.removeEventListener('resize', updateViewportHeight)
    }
  }, [])

  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [typingIndex, setTypingIndex] = useState(null)
  const [typedChars, setTypedChars] = useState(0)
  const KARAKTER_PER_TICK = 1
  const KECEPATAN_KETIK_MS = 20

  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, chatLoading, typedChars])

  useEffect(() => {
    if (typingIndex === null) return
    const teksLengkap = messages[typingIndex]?.text || ''
    if (typedChars >= teksLengkap.length) {
      setTypingIndex(null)
      return
    }
    const timer = setTimeout(() => {
      setTypedChars((prev) => Math.min(prev + KARAKTER_PER_TICK, teksLengkap.length))
    }, KECEPATAN_KETIK_MS)
    return () => clearTimeout(timer)
  }, [typingIndex, typedChars, messages])

  const [sidebarOpen, setSidebarOpen] = useState(false)
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
      const jawabanBaru = data.jawaban || 'Tidak ada jawaban'
      setMessages((prev) => {
        const pesanBaru = [...prev, { role: 'ai', text: jawabanBaru }]
        setTypingIndex(pesanBaru.length - 1)
        setTypedChars(0)
        return pesanBaru
      })
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
    setSidebarOpen(false)
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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg, color: C.textSecondary, fontFamily: 'sans-serif' }}>
        Memuat...
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg, fontFamily: 'sans-serif', padding: 20 }}>
        <div style={{ maxWidth: 340, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', color: C.text, marginBottom: 4 }}>Saitou-AI</h1>
          <p style={{ color: C.textSecondary, marginBottom: 28 }}>Masuk untuk mulai mengobrol</p>
          <button
            onClick={handleGoogleLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 20px',
              fontSize: 15,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: 'white',
              color: C.text,
              cursor: 'pointer',
            }}
          >
            Login dengan Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: `${viewportHeight}px`, overflow: 'hidden', fontFamily: 'sans-serif', background: C.bg }}>

      {showWelcome && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(21,18,16,0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            position: 'relative', background: C.bgElevated, color: C.text,
            borderRadius: 16, padding: 24, maxWidth: 380, textAlign: 'center',
            border: `1px solid ${C.border}`, overflow: 'hidden',
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
            <h2 style={{ marginTop: 0, fontFamily: 'Georgia, serif' }}>Halo, para Beta Tester yang luar biasa! 🌟</h2>
            <p style={{ lineHeight: 1.6 }}>
              Terima kasih sudah bergabung dan membantu kami memperbaiki platform ini. Tanpa kalian, inovasi kami tidak akan secepat ini. Selamat menjelajah, memberi masukan, dan bersenang-senang — semoga pengalaman kalian menyenangkan dan penuh inspirasi! 🎉
            </p>
            <p style={{ fontStyle: 'italic', color: C.textSecondary }}>Sampai jumpa di setiap update berikutnya!</p>
            <button
              onClick={tutupWelcome}
              style={{
                marginTop: 12, padding: '8px 20px', borderRadius: 8,
                border: 'none', background: C.accent, color: C.text,
                fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              Mulai Jelajahi
            </button>
          </div>
        </div>
      )}

      {showMemori && (
        <div
          onClick={() => setShowMemori(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(21,18,16,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 900,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', color: C.text, borderRadius: 16,
              padding: 20, maxWidth: 400, width: '100%', maxHeight: '70vh',
              overflowY: 'auto', border: `1px solid ${C.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontFamily: 'Georgia, serif' }}>Memori Tersimpan</h3>
              <button onClick={() => setShowMemori(false)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: C.textSecondary }}>✕</button>
            </div>
            {loadingMemori && <p style={{ color: C.textSecondary }}>Memuat memori...</p>}
            {!loadingMemori && memoriList.length === 0 && <p style={{ color: C.textSecondary }}>Belum ada memori tersimpan.</p>}
            {!loadingMemori && memoriList.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, padding: '10px 0' }}>
                <span style={{ flex: 1, marginRight: 10, fontSize: 14 }}>{m.isi}</span>
                <button onClick={() => hapusMemoriItem(m.id)} style={{ color: C.accentRare, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Hapus</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(21,18,16,0.4)', zIndex: 40 }}
        />
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
        background: C.bgSidebar, borderRight: `1px solid ${C.border}`,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease', zIndex: 50,
        display: 'flex', flexDirection: 'column', padding: 16,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 'bold', color: C.text }}>Saitou-AI</span>
          <button onClick={() => setSidebarOpen(false)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: C.textSecondary }}>✕</button>
        </div>

        <button
          onClick={toggleMemori}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
            padding: '10px 12px', borderRadius: 8, border: 'none',
            background: 'transparent', color: C.text, cursor: 'pointer',
            fontSize: 14, marginBottom: 4,
          }}
        >
          🧠 Kelola Memori
        </button>

        <a
          href="https://trakteer.id/Saitou-AI_for_all"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setSidebarOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8,
            color: C.text, textDecoration: 'none', fontSize: 14, marginBottom: 4,
          }}
        >
          💡 Dukung Saitou-AI
        </a>

        <a
          href="mailto:mi6562093@gmail.com?subject=Feedback%20Saitou-AI"
          onClick={() => setSidebarOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8,
            color: C.text, textDecoration: 'none', fontSize: 14,
          }}
        >
          🐞 Kirim Feedback
        </a>

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <p style={{ color: C.textSecondary, fontSize: 12, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.user.email}
          </p>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'white',
              color: C.text, cursor: 'pointer', fontSize: 14,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
          background: C.bg, flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.text, padding: 4 }}
          >
            ☰
          </button>
          <span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: 17, color: C.text }}>Saitou-AI</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.textSecondary, marginTop: 60, fontSize: 14 }}>
              Mulai percakapan dengan Saitou-AI
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
              <div
                className={m.role === 'ai' ? 'fade-in-message' : ''}
                style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: 14,
                background: m.role === 'user' ? C.bubbleUserBg : C.bgElevated,
                color: m.role === 'user' ? C.bubbleUserText : C.text,
                maxWidth: '82%',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                textAlign: 'left',
                fontSize: 15,
                lineHeight: 1.5,
              }}>
                {m.role === 'ai' ? (
                  i === typingIndex ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.text.slice(0, typedChars)}<span className="typing-cursor">▌</span></span>
                  ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({node, ...props}) => (
                        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                          <table style={{ borderCollapse: 'collapse', width: 'max-content' }} {...props} />
                        </div>
                      ),
                      th: ({node, ...props}) => (
                        <th style={{ border: `1px solid ${C.border}`, padding: '4px 8px', whiteSpace: 'nowrap', verticalAlign: 'top' }} {...props} />
                      ),
                      td: ({node, ...props}) => (
                        <td style={{ border: `1px solid ${C.border}`, padding: '4px 8px', whiteSpace: 'nowrap', verticalAlign: 'top' }} {...props} />
                      ),
                      h1: ({node, ...props}) => <h1 style={{ color: C.text }} {...props} />,
                      h2: ({node, ...props}) => <h2 style={{ color: C.text }} {...props} />,
                      h3: ({node, ...props}) => <h3 style={{ color: C.text }} {...props} />,
                      h4: ({node, ...props}) => <h4 style={{ color: C.text }} {...props} />,
                      pre: ({node, ...props}) => (
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'break-word', maxWidth: '100%', background: C.text, color: C.bg, padding: 8, borderRadius: 6 }} {...props} />
                      ),
                      code: ({node, ...props}) => (
                        <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'break-word' }} {...props} />
                      ),
                    }}
                  >{m.text}</ReactMarkdown>
                  )
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
          {chatLoading && <p style={{ color: C.textSecondary, fontSize: 14 }}>Mengetik...</p>}
          <div ref={messagesEndRef} />
        </div>

        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderTop: `1px solid ${C.border}`, background: C.bg,
          flexShrink: 0, boxSizing: 'border-box',
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Tulis pesan..."
            style={{
              flex: 1, padding: '10px 14px', fontSize: 15,
              borderRadius: 10, border: `1px solid ${C.border}`,
              outline: 'none', fontFamily: 'sans-serif',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={chatLoading}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: C.text, color: C.bg, cursor: 'pointer',
              fontWeight: 'bold', fontSize: 14,
            }}
          >
            Kirim
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
