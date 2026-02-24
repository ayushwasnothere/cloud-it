'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    loading: () => <Skeleton className="w-full h-full bg-neutral-800" />,
    ssr: false,
  }
)

interface EditorProps {
  filename: string
  filePath?: string
  language?: string
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function Editor({
  filename,
  filePath,
  language,
  value,
  onChange,
  readOnly = false,
}: EditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const detectLanguage = () => {
    const ext = filename.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sql: 'sql',
      yml: 'yaml',
      yaml: 'yaml',
    }
    return langMap[ext || ''] || 'plaintext'
  }

  if (!mounted) {
    return <Skeleton className="w-full h-full bg-neutral-800" />
  }

  return (
    <div className="w-full h-full">
      <MonacoEditor
        path={filePath || filename}
        value={value}
        onChange={(val) => onChange(val || '')}
        language={language || detectLanguage()}
        theme="vercel-dark"
        options={{
          automaticLayout: true,
          fontSize: 14,
          fontFamily: '"Fira Code", monospace',
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          smoothScrolling: true,
          contextmenu: true,
          readOnly,
          formatOnPaste: true,
          formatOnType: true,
          padding: { top: 16, bottom: 16 },
          wordWrap: 'on',
          wrappingIndent: 'indent',
          scrollBeyondLastLine: false,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          parameterHints: { enabled: true },
          inlineSuggest: { enabled: true },
          bracketPairColorization: { enabled: true },
        }}
        beforeMount={(monaco) => {
          monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
          monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2022,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          })
          monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2022,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          })

          monaco.editor.defineTheme('vercel-dark', {
            base: 'vs-dark',
            inherit: true,
            colors: {
              'editor.background': '#000000',
              'editor.foreground': '#ececec',
              'editor.lineNumbersColor': '#404040',
              'editor.lineHighlightBackground': '#1a1a1a',
              'editorCursor.foreground': '#ececec',
              'editor.selectionBackground': '#1e4d7b',
              'editor.wordHighlightBackground': '#1e4d7b',
            },
            rules: [],
          })
        }}
        onMount={(editor) => {
          editor.focus()
        }}
      />
    </div>
  )
}
