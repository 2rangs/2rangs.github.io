// 예전 블로그(posts 테이블)는 본문을 TipTap JSON으로 저장했다. 읽을 때 마크다운으로 바꾼다.
type Node = { type: string; text?: string; attrs?: Record<string, any>; marks?: { type: string; attrs?: Record<string, any> }[]; content?: Node[] }

function inline(nodes: Node[] = []): string {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return '  \n'
    if (node.type === 'image') return `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`
    let text = node.text ?? ''
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') text = `**${text}**`
      else if (mark.type === 'italic') text = `*${text}*`
      else if (mark.type === 'strike') text = `~~${text}~~`
      else if (mark.type === 'code') text = '`' + text + '`'
      else if (mark.type === 'link') text = `[${text}](${mark.attrs?.href ?? ''})`
    }
    return text
  }).join('')
}

function indent(text: string, pad: string) {
  return text.split('\n').map((line, index) => (index === 0 ? line : pad + line)).join('\n')
}

function block(node: Node): string {
  switch (node.type) {
    case 'heading': return '#'.repeat(Math.min(6, Math.max(1, node.attrs?.level ?? 2))) + ' ' + inline(node.content)
    case 'paragraph': return inline(node.content)
    case 'blockquote': return blocks(node.content).split('\n').map((line) => '> ' + line).join('\n')
    case 'codeBlock': return '```' + (node.attrs?.language ?? '') + '\n' + (node.content ?? []).map((child) => child.text ?? '').join('') + '\n```'
    case 'image': return `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`
    case 'horizontalRule': return '---'
    case 'bulletList': return (node.content ?? []).map((item) => '- ' + indent(blocks(item.content), '  ')).join('\n')
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1)
      return (node.content ?? []).map((item, index) => `${start + index}. ` + indent(blocks(item.content), '   ')).join('\n')
    }
    default: return node.content ? blocks(node.content) : (node.text ?? '')
  }
}

function blocks(nodes: Node[] = []): string {
  return nodes.map(block).join('\n\n')
}

export function tiptapToMarkdown(doc: unknown): string {
  if (typeof doc === 'string') {
    try { doc = JSON.parse(doc) } catch { return doc as string }
  }
  const root = doc as Node | null
  return root?.content ? blocks(root.content) : ''
}
