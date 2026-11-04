export async function exportBackupFile(filename: string, json: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([json], filename, { type: 'application/json' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // 공유 실패 시 다운로드로 대체
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    let settled = false
    const finish = (v: string | null) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
      input.remove()
      resolve(v)
    }
    // 한계: 파일 선택창 취소 이벤트가 없어, 창이 닫혀 포커스가 돌아온 뒤 일정 시간
    // change가 없으면 취소로 간주한다. 느린 기기에서는 부정확할 수 있다.
    const onFocus = () => setTimeout(() => finish(null), 1000)
    input.addEventListener('change', async () => {
      const f = input.files?.[0]
      if (!f) return finish(null)
      try {
        finish(await f.text())
      } catch {
        finish(null)
      }
    })
    window.addEventListener('focus', onFocus)
    document.body.appendChild(input)
    input.click()
  })
}
