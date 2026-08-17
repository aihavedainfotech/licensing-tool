import React, { createContext, useContext, useState } from 'react'

/* Shared context so uploaded File objects survive page navigation */
interface FileContextType {
  files: (File | null)[]
  s3Keys: (string | null)[]
  setFile: (index: number, file: File | null, s3Key?: string) => void
  clearFiles: () => void
}

const FileContext = createContext<FileContextType>({
  files: [null, null, null],
  s3Keys: [null, null, null],
  setFile: () => {},
  clearFiles: () => {},
})

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [files,  setFiles]  = useState<(File | null)[]>([null, null, null])
  const [s3Keys, setS3Keys] = useState<(string | null)[]>([null, null, null])

  function setFile(index: number, file: File | null, s3Key?: string) {
    setFiles(prev => { const n = [...prev]; n[index] = file; return n })
    setS3Keys(prev => { const n = [...prev]; n[index] = s3Key ?? null; return n })
  }

  function clearFiles() {
    setFiles([null, null, null])
    setS3Keys([null, null, null])
  }

  return (
    <FileContext.Provider value={{ files, s3Keys, setFile, clearFiles }}>
      {children}
    </FileContext.Provider>
  )
}

export const useFiles = () => useContext(FileContext)
