import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import LandingPage from './pages/LandingPage'
import UploadPage from './pages/UploadPage'
import ResultsPage from './pages/ResultsPage'
import ConfigUploadPage from './pages/ConfigUploadPage'
import TemplatesPage from './pages/TemplatesPage'
import HelpPage from './pages/HelpPage'
import { FileProvider } from './context/FileContext'
import { TemplateProvider } from './context/TemplateContext'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.3, ease: 'easeIn' } },
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ minHeight: '100vh' }}
      >
        <Routes location={location}>
          <Route path="/"       element={<LandingPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/config" element={<ConfigUploadPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TemplateProvider>
        <FileProvider>
          <AnimatedRoutes />
        </FileProvider>
      </TemplateProvider>
    </BrowserRouter>
  )
}
