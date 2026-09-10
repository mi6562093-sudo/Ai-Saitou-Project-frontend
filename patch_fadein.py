import re

path = 'src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

hasil = []

anchor = """              <div style={{
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
              }}>"""
tambahan = """              <div
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
              }}>"""
jumlah = content.count(anchor)
content = content.replace(anchor, tambahan, 1)
hasil.append(f"Tambah className fade-in ke bubble AI: {'BERHASIL' if jumlah >= 1 else 'GAGAL'}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n".join(hasil))
