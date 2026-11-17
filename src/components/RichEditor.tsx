import { useRef, useState } from 'react'
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

// 화면에서는 서식이 보이는 에디터로 쓰고, 저장은 마크다운 문자열로 한다.
export function RichEditor({ initial, onChange, onNotice }: Props) {
  const picker = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [uploading, setUploading] = useState(0)

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
      Placeholder.configure({ placeholder: '본문을 쓰세요. 이미지는 붙여넣거나 끌어다 놓을 수 있습니다.' }),
      MarkdownExtension.configure({ html: false, linkify: true, transformPastedText: true }),
    ],
    content: initial,
    editorProps: {
      attributes: { class: 'prose', 'aria-label': '본문' },
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
    onUpdate: ({ editor: current }) => onChange((current.storage as any).markdown.getMarkdown()),
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
    <div className="rich">
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
    </div>
  )
}
