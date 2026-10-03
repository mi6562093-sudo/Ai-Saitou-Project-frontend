import { memo, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Kecepatan munculnya teks. MS_PER_TICK adalah jarak antar langkah, dan
// TARGET_TICK_TEKS membuat seluruh teks selesai dalam jumlah langkah yang
// tetap, apa pun panjangnya. Jadi paragraf panjang tidak terasa lebih lambat
// daripada paragraf pendek, hanya lompatannya lebih besar per langkah.
const MS_PER_TICK = 16
const TARGET_TICK_TEKS = 180
const JEDA_SEBELUM_TABEL = 200
// Batas lompatan per tick. Satu berarti benar-benar satu karakter per
// langkah, dan itu yang paling terasa seperti mengetik. Browser hanya
// menggambar 60 kali per detik, jadi satu karakter per gambar sudah
// mentok di 16 milidetik; teks yang sangat panjang karena itu diizinkan
// maju dua karakter supaya tabel di bawahnya tidak menunggu kelamaan.
const MAKS_LANGKAH_TEKS = 2

// Pisahkan pesan jadi blok tabel dan blok bukan tabel. Tabel tidak pernah
// diketik, karena memotong tabel di tengah baris membuat pipa dan tanda hubung
// tercetak apa adanya.
export function pecahBlok(teks) {
  const baris = String(teks || '').split('\n')
  const blok = []
  let kumpul = []
  let modeTabel = false

  const simpan = () => {
    if (kumpul.length === 0) return
    blok.push({ tipe: modeTabel ? 'tabel' : 'teks', isi: kumpul.join('\n') })
    kumpul = []
  }

  for (const b of baris) {
    const iniTabel = b.trim().startsWith('|')
    if (iniTabel !== modeTabel) {
      simpan()
      modeTabel = iniTabel
    }
    kumpul.push(b)
  }
  simpan()
  return blok.filter((x) => x.isi.trim() !== '')
}

// Daftar posisi yang aman untuk memotong markdown, yaitu posisi di mana semua
// penanda inline sudah tertutup. Inilah yang membuat efek ketik tidak pernah
// memperlihatkan simbol: potongan yang dikirim ke perender selalu markdown yang
// sah, jadi kata tebal langsung muncul dalam keadaan tebal dan tidak ada
// pertukaran tampilan di akhir yang bisa menggeser tata letak.
export function titikAman(md) {
  const teks = String(md || '')
  const aman = []
  const penandaAwal = '#->*+0123456789. \t'
  let tebal = false
  let miring = false
  let kode = false
  let link = 0
  let awalBaris = true
  let i = 0

  while (i < teks.length) {
    const c = teks[i]

    if (c === '\n') {
      awalBaris = true
      i += 1
    } else {
      // Selama masih di rentetan penanda awal baris (#, -, angka, spasi),
      // posisi tidak dianggap aman. Memotong tepat setelah ### membuat tanda
      // pagarnya tercetak sebagai teks biasa.
      if (awalBaris && penandaAwal.indexOf(c) === -1) awalBaris = false

      if (teks.slice(i, i + 2) === '**') {
        tebal = !tebal
        i += 2
      } else if (c === '`') {
        kode = !kode
        i += 1
      } else if (c === '*' && !awalBaris) {
        miring = !miring
        i += 1
      } else if (c === '[') {
        link += 1
        i += 1
      } else if (c === ')' && link > 0) {
        link -= 1
        i += 1
      } else {
        i += 1
      }
    }

    if (!tebal && !miring && !kode && link === 0 && !awalBaris) aman.push(i)
  }

  if (aman.length === 0 || aman[aman.length - 1] !== teks.length) aman.push(teks.length)
  return aman
}

// Warna dikirim sebagai nilai tunggal, bukan objek tema, supaya memo bisa
// membandingkannya dengan benar. Kalau objek tema dikirim utuh, setiap render
// induk menghasilkan objek baru dan memo jadi tidak ada gunanya.
const Blok = memo(function Blok({ md, warnaTeks, warnaGaris, warnaBg, kelas, bungkus }) {
  const komponen = {
    table: ({ node, ...props }) => (
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content' }} {...props} />
      </div>
    ),
    th: ({ node, style, ...props }) => (
      <th style={{ border: `1px solid ${warnaGaris}`, padding: '4px 8px', whiteSpace: 'nowrap', verticalAlign: 'top', ...style }} {...props} />
    ),
    td: ({ node, style, ...props }) => (
      <td style={{ border: `1px solid ${warnaGaris}`, padding: '4px 8px', whiteSpace: 'nowrap', verticalAlign: 'top', ...style }} {...props} />
    ),
    h1: ({ node, ...props }) => <h1 style={{ color: warnaTeks }} {...props} />,
    h2: ({ node, ...props }) => <h2 style={{ color: warnaTeks }} {...props} />,
    h3: ({ node, ...props }) => <h3 style={{ color: warnaTeks }} {...props} />,
    h4: ({ node, ...props }) => <h4 style={{ color: warnaTeks }} {...props} />,
    pre: ({ node, ...props }) => (
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'break-word', maxWidth: '100%', background: warnaTeks, color: warnaBg, padding: 8, borderRadius: 6 }} {...props} />
    ),
    code: ({ node, ...props }) => (
      <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'break-word' }} {...props} />
    ),
  }

  const isi = (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={komponen}>{md}</ReactMarkdown>
  )

  // Blok teks dibungkus display:contents supaya pemecahan blok tidak mengubah
  // jarak antar paragraf. Blok tabel butuh kotak sendiri karena dia yang
  // membawa animasi muncul.
  if (!bungkus) return <div style={{ display: 'contents' }}>{isi}</div>
  return <div className={kelas}>{isi}</div>
})

export default function PesanAI({ teks, C, animasi }) {
  const blok = useMemo(() => pecahBlok(teks), [teks])

  // Satu daftar datar berisi setiap langkah kemunculan. Blok teks menyumbang
  // satu langkah per titik potong, blok tabel hanya satu langkah.
  const tahapan = useMemo(() => {
    const t = []
    blok.forEach((b, bi) => {
      if (b.tipe === 'tabel') {
        t.push({ bi, potong: b.isi.length, tabel: true })
      } else {
        titikAman(b.isi).forEach((p) => t.push({ bi, potong: p, tabel: false }))
      }
    })
    return t
  }, [blok])

  const langkahTeks = useMemo(() => {
    const jml = tahapan.filter((t) => !t.tabel).length
    return Math.min(MAKS_LANGKAH_TEKS, Math.max(1, Math.ceil(jml / TARGET_TICK_TEKS)))
  }, [tahapan])

  const [iTahap, setITahap] = useState(0)

  useEffect(() => {
    setITahap(animasi ? 0 : Math.max(0, tahapan.length - 1))
  }, [animasi, tahapan])

  useEffect(() => {
    if (!animasi) return
    if (tahapan.length === 0) return
    if (iTahap >= tahapan.length - 1) return

    const berikut = tahapan[iTahap + 1]
    const jeda = berikut && berikut.tabel ? JEDA_SEBELUM_TABEL : MS_PER_TICK

    const pewaktu = setTimeout(() => {
      setITahap((dari) => {
        let target = Math.min(dari + langkahTeks, tahapan.length - 1)
        // Jangan melompati langkah tabel. Tabel harus mendapat jedanya sendiri.
        for (let k = dari + 1; k <= target; k += 1) {
          if (tahapan[k].tabel) return k
        }
        return target
      })
    }, jeda)

    return () => clearTimeout(pewaktu)
  }, [animasi, iTahap, tahapan, langkahTeks])

  if (!teks) return null
  if (tahapan.length === 0) return null

  const sekarang = tahapan[Math.min(iTahap, tahapan.length - 1)]

  return (
    <>
      {blok.map((b, bi) => {
        if (bi > sekarang.bi) return null
        const md = bi < sekarang.bi ? b.isi : b.isi.slice(0, sekarang.potong)
        if (!md.trim()) return null
        return (
          <Blok
            key={bi}
            md={md}
            warnaTeks={C.text}
            warnaGaris={C.border}
            warnaBg={C.bg}
            bungkus={b.tipe === 'tabel'}
            kelas={animasi && b.tipe === 'tabel' ? 'fade-in-message' : undefined}
          />
        )
      })}
    </>
  )
}
