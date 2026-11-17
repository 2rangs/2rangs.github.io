import { useRef, useState, type MutableRefObject } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown as MarkdownExtension } from 'tiptap-markdown'
import { uploadImage } from '../lib/images'

type Props = { initial: string; onChange: (markdown: string) => void; onNotice: (text: string, isError?: boolean) => void }

const imageFiles = (list?: FileList | null) => Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))

function Tool({ label, title, active, onClick }: { label: string; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {label}
    </button>
  )
}

// 빈 줄 맨 앞에서 '/'를 치면 커서 자리에 넣을 블록을 고르는 메뉴가 뜬다.
type BlockItem = { id: string; label: string; hint: string; keywords: string; run: (editor: Editor, pickImage: () => void) => void }
const BLOCKS: BlockItem[] = [
  { id: 'h2', label: '제목 2', hint: '큰 소제목. 목차에 나온다', keywords: 'h2 heading 제목 소제목', run: (e) => e.chain().focus().setNode('heading', { level: 2 }).run() },
  { id: 'h3', label: '제목 3', hint: '작은 소제목', keywords: 'h3 heading 제목', run: (e) => e.chain().focus().setNode('heading', { level: 3 }).run() },
  { id: 'image', label: '이미지', hint: '파일을 골라 이 자리에 넣는다', keywords: 'image img 이미지 사진 그림', run: (_e, pickImage) => pickImage() },
  { id: 'code', label: '코드 블록', hint: '언어를 적으면 색이 입혀진다', keywords: 'code 코드 pre', run: (e) => e.chain().focus().setCodeBlock({ language: 'ts' }).run() },
  { id: 'quote', label: '인용', hint: '인용문이나 짧은 요약', keywords: 'quote 인용 blockquote', run: (e) => e.chain().focus().setBlockquote().run() },
  { id: 'note', label: '참고 상자', hint: '본문 흐름 밖의 덧붙임', keywords: 'note callout 참고 주의 팁', run: (e) => e.chain().focus().setBlockquote().insertContent([{ type: 'text', text: '참고', marks: [{ type: 'bold' }] }, { type: 'text', text: ' ' }]).run() },
  { id: 'bullet', label: '글머리 목록', hint: '순서 없는 목록', keywords: 'list ul bullet 목록', run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'ordered', label: '번호 목록', hint: '순서 있는 목록', keywords: 'ol ordered number 번호', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'hr', label: '구분선', hint: '흐름을 끊어 준다', keywords: 'hr divider 구분선 줄', run: (e) => e.chain().focus().setHorizontalRule().run() },
]

type Menu = { from: number; to: number; query: string; top: number; left: number; index: number }

const matches = (query: string) => {
  const word = query.toLowerCase()
  return BLOCKS.filter((item) => !word || item.label.toLowerCase().includes(word) || item.keywords.includes(word))
}

function readMenu(editor: Editor, holder: HTMLElement | null, previous: Menu | null): Menu | null {
  const { selection } = editor.state
  if (!selection.empty || !holder) return null
  const { $from } = selection
  if ($from.parent.type.name !== 'paragraph') return null
  const typed = $from.parent.textBetween(0, $from.parentOffset)
  const found = /^\/([^\s/]{0,20})$/.exec(typed)
  if (!found) return null
  const coords = editor.view.coordsAtPos($from.pos)
  const box = holder.getBoundingClientRect()
  return {
    from: $from.start(),
    to: $from.pos,
    query: found[1],
    top: coords.bottom - box.top + 6,
    left: Math.min(coords.left - box.left, box.width - 280),
    index: previous && previous.query === found[1] ? previous.index : 0,
  }
}

function SlashMenu({ menu, onPick, onHover }: { menu: Menu; onPick: (item: BlockItem) => void; onHover: (index: number) => void }) {
  const items = matches(menu.query)
  return (
    <div className="slash-menu" role="listbox" aria-label="넣을 블록" style={{ top: menu.top, left: Math.max(8, menu.left) }}>
      {items.length === 0 && <p className="slash-empty">맞는 블록이 없습니다.</p>}
      {items.map((item, index) => (
        <button key={item.id} type="button" role="option" aria-selected={index === menu.index}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => onHover(index)} onClick={() => onPick(item)}>
          <strong>{item.label}</strong><span>{item.hint}</span>
        </button>
      ))}
    </div>
  )
}

// 화면에서는 서식이 보이는 에디터로 쓰고, 저장은 마크다운 문자열로 한다.
export function RichEditor({ initial, onChange, onNotice }: Props) {
  const picker = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [uploading, setUploading] = useState(0)
  const holder = useRef<HTMLDivElement>(null)
  const [menu, setMenuState] = useState<Menu | null>(null)
  // 에디터의 키 처리 함수는 한 번만 만들어지므로 최신 메뉴 상태를 ref로도 들고 있는다.
  const menuRef = useRef<Menu | null>(null) as MutableRefObject<Menu | null>
  const setMenu = (next: Menu | null) => { menuRef.current = next; setMenuState(next) }
  const pickImage = () => picker.current?.click()

  function pick(item: BlockItem) {
    const current = menuRef.current
    const editor = editorRef.current
    if (!current || !editor) return
    setMenu(null)
    // 입력한 '/검색어'를 지운 뒤 그 자리에 블록을 넣는다.
    editor.chain().focus().deleteRange({ from: current.from, to: current.to }).run()
    item.run(editor, pickImage)
  }
  const pickRef = useRef(pick)
  pickRef.current = pick

  async function insertImages(files: File[]) {
    for (const file of files) {
      setUploading((count) => count + 1)
      try {
        const { url, embedded } = await uploadImage(file)
        editorRef.current?.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run()
        if (embedded) onNotice('이미지 저장소에 올리지 못해 본문에 직접 넣었습니다. Supabase Storage에 공개 버킷 "blog-images"를 만들면 파일로 올라갑니다.')
      } catch (reason: any) {
        onNotice(String(reason?.message ?? reason), true)
      }
      setUploading((count) => count - 1)
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "본문을 쓰세요. 빈 줄에서 '/'를 치면 제목·이미지·코드 블록 등을 바로 넣을 수 있습니다." }),
      MarkdownExtension.configure({ html: false, linkify: true, transformPastedText: true }),
    ],
    content: initial,
    editorProps: {
      attributes: { class: 'prose', 'aria-label': '본문' },
      handleKeyDown: (_view, event) => {
        const current = menuRef.current
        if (!current) return false
        const items = matches(current.query)
        if (event.key === 'Escape') { setMenu(null); return true }
        if (!items.length) return false
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const step = event.key === 'ArrowDown' ? 1 : -1
          setMenu({ ...current, index: (current.index + step + items.length) % items.length })
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          pickRef.current(items[Math.min(current.index, items.length - 1)])
          return true
        }
        return false
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files)
        if (!files.length) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = imageFiles((event as DragEvent).dataTransfer?.files)
        if (!files.length) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange((current.storage as any).markdown.getMarkdown())
      setMenu(readMenu(current, holder.current, menuRef.current))
    },
    onSelectionUpdate: ({ editor: current }) => setMenu(readMenu(current, holder.current, menuRef.current)),
    onBlur: () => setMenu(null),
  })
  editorRef.current = editor

  if (!editor) return null
  const chain = () => editor.chain().focus()

  function link() {
    const previous = editor!.getAttributes('link').href ?? ''
    const url = prompt('링크 주소', previous)
    if (url === null) return
    if (url === '') chain().extendMarkRange('link').unsetLink().run()
    else chain().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="rich" ref={holder}>
      <div className="toolbar" role="toolbar" aria-label="서식">
        <Tool label="H2" title="제목 2" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
        <Tool label="H3" title="제목 3" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
        <span className="toolbar-gap" />
        <Tool label="굵게" title="굵게" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} />
        <Tool label="기울임" title="기울임" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} />
        <Tool label="취소선" title="취소선" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} />
        <Tool label="코드" title="인라인 코드" active={editor.isActive('code')} onClick={() => chain().toggleCode().run()} />
        <span className="toolbar-gap" />
        <Tool label="목록" title="글머리 목록" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()} />
        <Tool label="번호" title="번호 목록" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()} />
        <Tool label="인용" title="인용" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()} />
        <Tool label="코드 블록" title="코드 블록" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()} />
        <Tool label="구분선" title="구분선" onClick={() => chain().setHorizontalRule().run()} />
        <span className="toolbar-gap" />
        <Tool label="링크" title="링크" active={editor.isActive('link')} onClick={link} />
        <Tool label={uploading ? '올리는 중…' : '이미지'} title="이미지 넣기" onClick={() => picker.current?.click()} />
        <input ref={picker} type="file" accept="image/*" multiple hidden
          onChange={(event) => { insertImages(imageFiles(event.target.files)); event.target.value = '' }} />
      </div>
      <EditorContent editor={editor} />
      {menu && <SlashMenu menu={menu} onPick={pick} onHover={(index) => setMenu({ ...menu, index })} />}
    </div>
  )
}
