import { useEffect, useRef } from 'react'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'

type MarkdownEditorProps = {
  initialDoc: string
  onChange?: (doc: string) => void
  onSelectionChange?: (selection: string) => void
}

export function MarkdownEditor({
  initialDoc,
  onChange,
  onSelectionChange,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)

  useEffect(() => {
    onChangeRef.current = onChange
    onSelectionChangeRef.current = onSelectionChange
  }, [onChange, onSelectionChange])

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        history(),
        markdown(),
        syntaxHighlighting(oneDarkHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        placeholder('开始写作...'),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }

          if (update.selectionSet || update.docChanged) {
            const range = update.state.selection.main
            const selected = update.state.doc.sliceString(range.from, range.to)
            onSelectionChangeRef.current?.(selected)
          }
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '18px',
            backgroundColor: 'var(--editor-background)',
            color: 'var(--foreground)',
          },
          '.cm-scroller': {
            fontFamily:
              '"Songti SC", "Noto Serif SC", ui-serif, Georgia, serif',
            lineHeight: '1.78',
            padding: '24px 0',
            scrollbarColor: '#5a5a5a transparent',
            scrollbarWidth: 'thin',
          },
          '.cm-content': {
            caretColor: 'var(--foreground)',
            maxWidth: '780px',
            margin: '0 auto',
            minHeight: '100%',
            padding: '0 44px 88px',
          },
          '.cm-placeholder': {
            color: 'var(--muted-foreground)',
          },
          '.cm-lineNumbers': {
            color: 'var(--muted-foreground)',
            fontFamily:
              '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
            fontSize: '12px',
            paddingRight: '12px',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--editor-gutter)',
            borderRight: '1px solid var(--editor-gutter-border)',
            color: 'var(--muted-foreground)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--editor-line-highlight)',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--editor-line-highlight)',
          },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: '#264f78',
          },
          '&.cm-focused': {
            outline: 'none',
          },
        }),
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [initialDoc])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentDoc = view.state.doc.toString()
    if (currentDoc === initialDoc) return

    view.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: initialDoc,
      },
    })
  }, [initialDoc])

  return <div className="markdown-editor" ref={containerRef} />
}
